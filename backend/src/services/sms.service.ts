import { config } from '../config';
import { SITE_NAME } from '../config/site';
import { AppError } from '../utils/errors';

const FARAZSMS_PATTERN_URL = 'https://api.iranpayamak.com/ws/v1/sms/pattern';
const FARAZSMS_SIMPLE_URL = 'https://api.iranpayamak.com/ws/v1/sms/simple';

interface FarazSmsPatternPayload {
  code: string;
  attributes: Record<string, string>;
  recipient: string;
  line_number: string;
  number_format: 'english' | 'persian';
  schedule?: string | null;
}

interface FarazSmsSimplePayload {
  text: string;
  line_number: string;
  recipients: string[];
  number_format: 'english' | 'persian';
  schedule?: string | null;
}

interface FarazSmsResponse {
  status?: string | number;
  message?: string;
  data?: unknown;
}

export class SmsService {
  private usesMeliPayamak(): boolean {
    return config.sms.provider === 'melipayamak';
  }

  isConfigured(): boolean {
    if (this.usesMeliPayamak()) {
      const { username, password, apiKey } = config.sms.melipayamak;
      return Boolean(username && (apiKey || password));
    }
    const { apiKey, lineNumber } = config.sms.farazsms;
    return Boolean(apiKey && lineNumber);
  }

  /**
   * Panel credit for admin settings via Melipayamak GetUserCredit2 (balance in Rials).
   * Docs: https://www.melipayamak.com/api/getusercredit2/
   */
  async getCreditStatus(): Promise<{
    provider: 'melipayamak' | 'farazsms';
    configured: boolean;
    credit: number | null;
    creditRials: number | null;
    creditLabel: string;
    unit: 'rial' | null;
    lowCredit: boolean;
    warning: string | null;
  }> {
    const provider = this.usesMeliPayamak() ? 'melipayamak' : 'farazsms';
    const configured = this.isConfigured();

    if (!configured) {
      return {
        provider,
        configured: false,
        credit: null,
        creditRials: null,
        creditLabel: 'پیکربندی نشده',
        unit: null,
        lowCredit: true,
        warning: 'سرویس پیامک روی سرور پیکربندی نشده است.',
      };
    }

    if (!this.usesMeliPayamak()) {
      return {
        provider,
        configured: true,
        credit: null,
        creditRials: null,
        creditLabel: 'نامشخص',
        unit: null,
        lowCredit: false,
        warning: 'دریافت موجودی ریالی فقط برای ملی‌پیامک پشتیبانی می‌شود.',
      };
    }

    try {
      const creditRials = await this.fetchMeliCreditRials();
      if (creditRials === -1) {
        return {
          provider,
          configured: true,
          credit: null,
          creditRials: null,
          creditLabel: 'خطا در احراز هویت',
          unit: null,
          lowCredit: true,
          warning: 'نام کاربری یا API Key پنل پیامک صحیح نیست.',
        };
      }
      if (!Number.isFinite(creditRials)) {
        return {
          provider,
          configured: true,
          credit: null,
          creditRials: null,
          creditLabel: 'نامشخص',
          unit: null,
          lowCredit: true,
          warning: 'پاسخ موجودی از پنل پیامک قابل خواندن نبود.',
        };
      }

      // Warn when balance is under ~50,000 toman (500,000 rials).
      const lowCredit = creditRials < 500_000;
      const creditLabel = `${creditRials.toLocaleString('fa-IR', {
        maximumFractionDigits: 0,
      })} ریال`;

      return {
        provider,
        configured: true,
        credit: creditRials,
        creditRials,
        creditLabel,
        unit: 'rial',
        lowCredit,
        warning: lowCredit
          ? 'موجودی پنل پیامک کم است؛ برای ارسال OTP و نوتیف سفارش شارژ کنید.'
          : null,
      };
    } catch (error) {
      console.error('Melipayamak GetUserCredit2 failed:', error instanceof Error ? error.message : error);
      return {
        provider,
        configured: true,
        credit: null,
        creditRials: null,
        creditLabel: 'خطا در دریافت',
        unit: null,
        lowCredit: true,
        warning: error instanceof AppError ? error.message : 'دریافت موجودی پنل پیامک ناموفق بود.',
      };
    }
  }

  /** Melipayamak Users.asmx GetUserCredit2 — returns panel balance in Rials (-1 = bad credentials). */
  private async fetchMeliCreditRials(): Promise<number> {
    const { username } = config.sms.melipayamak;
    const credential = this.meliCredential();
    if (!username || !credential) {
      throw new AppError(503, 'سرویس پیامک پیکربندی نشده است', 'SMS_NOT_CONFIGURED');
    }

    let response: Response;
    try {
      response = await fetch('https://api.payamak-panel.com/post/Users.asmx/GetUserCredit2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password: credential }),
      });
    } catch (error) {
      console.error('Melipayamak GetUserCredit2 request failed:', error);
      throw new AppError(502, 'دریافت موجودی پنل پیامک ناموفق بود', 'SMS_REQUEST_FAILED');
    }

    const bodyText = await response.text();
    const match = bodyText.match(/>([-+]?(?:\d+\.?\d*|\.\d+))</);
    if (!match) {
      console.error('Melipayamak GetUserCredit2 unexpected body:', bodyText.slice(0, 300));
      throw new AppError(502, 'پاسخ موجودی از پنل پیامک قابل خواندن نبود', 'SMS_CREDIT_PARSE_FAILED');
    }
    return Number(match[1]);
  }

  /** Panel error -110 means the password field must carry the API key. */
  private meliCredential(): string {
    const { apiKey, password } = config.sms.melipayamak;
    return apiKey || password;
  }

  private async postMeliRaw(
    path: string,
    fields: Record<string, string> = {}
  ): Promise<{ http: number; RetStatus?: number | string; StrRetStatus?: string; Value?: string }> {
    const { username } = config.sms.melipayamak;
    const credential = this.meliCredential();
    if (!username || !credential) {
      throw new AppError(503, 'سرویس پیامک پیکربندی نشده است', 'SMS_NOT_CONFIGURED');
    }

    let response: Response;
    try {
      response = await fetch(`https://rest.payamak-panel.com/api/SendSMS/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password: credential, ...fields }),
      });
    } catch (error) {
      console.error('MeliPayamak request failed:', error);
      throw new AppError(502, 'ارسال پیامک با خطا مواجه شد', 'SMS_REQUEST_FAILED');
    }

    const payload = (await response.json().catch(() => ({}))) as {
      RetStatus?: number | string;
      StrRetStatus?: string;
      Value?: string;
    };
    return { http: response.status, ...payload };
  }

  private async postMeli(path: string, fields: Record<string, string>): Promise<{ RetStatus?: number | string; StrRetStatus?: string; Value?: string }> {
    const payload = await this.postMeliRaw(path, fields);
    const value = String(payload.Value ?? '').trim();
    // Real success returns a long numeric recId. Short Value is an error code even when
    // StrRetStatus is misleadingly "Ok" (e.g. Value=2 → insufficient credit).
    const recIdOk = /^\d{10,}$/.test(value);
    if (payload.http >= 400 || !recIdOk) {
      const meaning = this.meliValueMeaning(value);
      console.error('MeliPayamak error:', {
        http: payload.http,
        RetStatus: payload.RetStatus,
        StrRetStatus: payload.StrRetStatus,
        Value: value,
        meaning,
      });
      throw new AppError(502, meaning || 'ارسال پیامک ناموفق بود', 'SMS_SEND_FAILED');
    }
    return payload;
  }

  /** Map Melipayamak short Value codes to Persian operator-facing messages. */
  private meliValueMeaning(value: string): string {
    const map: Record<string, string> = {
      '0': 'نام کاربری یا رمز عبور پیامک اشتباه است',
      '2': 'اعتبار پنل پیامک کافی نیست — حساب ملی‌پیامک را شارژ کنید',
      '3': 'محدودیت ارسال روزانه پنل پیامک',
      '5': 'شماره خط فرستنده پیامک معتبر نیست',
      '6': 'سامانه پیامک موقتاً در دسترس نیست',
      '7': 'متن پیامک شامل کلمات غیرمجاز است',
      '9': 'ارسال از این خط از طریق وب‌سرویس مجاز نیست',
      '10': 'کاربر پنل پیامک غیرفعال است',
      '11': 'قالب پیامک (bodyId) نامعتبر است یا متغیرها جور نیست',
      '12': 'مدارک پنل پیامک کامل نیست',
      '14': 'متن پیامک خالی است',
      '16': 'شماره گیرنده پیامک صحیح نیست',
      '20': 'گیرنده در لیست سیاه است',
      '21': 'پیامک تکراری پذیرفته نشد',
      '24': 'پارامترهای ارسال پیامک نامعتبر است',
      '35': 'داده ارسالی به پنل پیامک نامعتبر است',
      '-110': 'رمز عبور پنل باید API Key باشد',
    };
    return map[value] || '';
  }

  /** Pattern SMS on the Melli Payamak service line. Variables are joined with `;`. */
  private async sendMeliPattern(bodyId: string, variables: string[], recipient: string): Promise<void> {
    if (!bodyId) {
      throw new AppError(503, 'سرویس پیامک پیکربندی نشده است', 'SMS_NOT_CONFIGURED');
    }
    await this.postMeli('BaseServiceNumber', {
      text: variables.map((value) => value.replace(/[;\r\n]/g, ' ').trim() || '-').join(';'),
      to: this.formatRecipient(recipient),
      bodyId,
    });
  }

  /** Fixed OTP text from SendOtp: «کد تایید شما Code: {code}». */
  private async sendMeliOtp(recipient: string, otpCode: string): Promise<void> {
    const { sender } = config.sms.melipayamak;
    if (!sender) {
      throw new AppError(503, 'شماره خط پیامک تنظیم نشده است', 'SMS_NOT_CONFIGURED');
    }
    const code = otpCode.replace(/\D/g, '');
    if (!code) {
      throw new AppError(400, 'کد تأیید نامعتبر است', 'SMS_SEND_FAILED');
    }
    await this.postMeli('SendOtp', {
      from: sender,
      to: this.formatRecipient(recipient),
      code,
    });
  }

  /** Customer + shop manager SMS after a paid order, using the old shop patterns. */
  async sendPaidOrderNotices(input: {
    phone: string;
    customerName: string;
    orderNumber: string;
    itemNames: string[];
  }): Promise<void> {
    if (!this.usesMeliPayamak()) {
      return;
    }

    const items = input.itemNames.filter(Boolean).join('، ').slice(0, 180) || '-';
    const firstName = input.customerName.trim().split(/\s+/)[0] || 'مشتری';
    const { customerBodyId } = config.sms.melipayamak;

    if (customerBodyId) {
      await this.sendMeliPattern(customerBodyId, [firstName, input.orderNumber, items], input.phone);
    }
  }

  private formatRecipient(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('98') && digits.length === 12) {
      return `0${digits.slice(2)}`;
    }
    if (digits.startsWith('9') && digits.length === 10) {
      return `0${digits}`;
    }
    return digits.startsWith('0') ? digits : phone;
  }

  private async sendPattern(
    patternCode: string,
    attributes: Record<string, string>,
    recipient: string
  ): Promise<void> {
    const { apiKey, lineNumber, numberFormat } = config.sms.farazsms;

    const payload: FarazSmsPatternPayload = {
      code: patternCode,
      attributes,
      recipient: this.formatRecipient(recipient),
      line_number: lineNumber,
      number_format: numberFormat,
      schedule: null,
    };

    await this.postJson(FARAZSMS_PATTERN_URL, payload);
  }

  private async sendSimpleText(recipient: string, text: string): Promise<void> {
    const { lineNumber, numberFormat } = config.sms.farazsms;

    const payload: FarazSmsSimplePayload = {
      text,
      line_number: lineNumber,
      recipients: [this.formatRecipient(recipient)],
      number_format: numberFormat,
      schedule: null,
    };

    await this.postJson(FARAZSMS_SIMPLE_URL, payload);
  }

  private async postJson(url: string, payload: object): Promise<void> {
    const { apiKey } = config.sms.farazsms;

    if (!apiKey) {
      throw new AppError(503, 'سرویس پیامک پیکربندی نشده است', 'SMS_NOT_CONFIGURED');
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Api-Key': apiKey,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('FarazSMS request failed:', error);
      throw new AppError(502, 'ارسال پیامک با خطا مواجه شد', 'SMS_REQUEST_FAILED');
    }

    const bodyText = await response.text();
    let body: FarazSmsResponse = {};
    if (bodyText) {
      try {
        body = JSON.parse(bodyText) as FarazSmsResponse;
      } catch {
        body = { message: bodyText };
      }
    }

    if (response.status === 401) {
      throw new AppError(503, 'پیکربندی سرویس پیامک نامعتبر است', 'SMS_UNAUTHORIZED');
    }

    if (!response.ok || body.status === 'error') {
      console.error('FarazSMS error:', response.status, body);
      throw new AppError(502, body.message || 'ارسال پیامک ناموفق بود', 'SMS_SEND_FAILED');
    }
  }

  /** Send OTP via FarazSMS pattern API (fast delivery, suitable for OTP). */
  async sendOtp(recipient: string, otpCode: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new AppError(
        503,
        'سرویس پیامک پیکربندی نشده است. لطفاً بعداً دوباره تلاش کنید.',
        'SMS_NOT_CONFIGURED'
      );
    }

    if (this.usesMeliPayamak()) {
      const { otpBodyId } = config.sms.melipayamak;
      // Prefer approved pattern template; fall back to SendOtp fixed text.
      if (otpBodyId) {
        await this.sendMeliPattern(otpBodyId, [otpCode], recipient);
      } else {
        await this.sendMeliOtp(recipient, otpCode);
      }
      if (config.nodeEnv !== 'production') {
        console.log(`📱 OTP SMS queued for ${this.formatRecipient(recipient)}`);
      }
      return;
    }

    const { patternCode, otpAttribute } = config.sms.farazsms;
    if (!patternCode) {
      throw new AppError(503, 'الگوی پیامک OTP پیکربندی نشده است', 'SMS_NOT_CONFIGURED');
    }

    await this.sendPattern(patternCode, { [otpAttribute]: otpCode }, recipient);

    if (config.nodeEnv !== 'production') {
      console.log(`📱 OTP SMS queued for ${this.formatRecipient(recipient)}`);
    }
  }

  /** Notify customer when order is packed / handed to courier. */
  async sendOrderPacked(recipient: string, orderNumber: string): Promise<void> {
    const formatted = this.formatRecipient(recipient);
    const { packedPatternCode, orderAttribute } = config.sms.farazsms;

    if (this.usesMeliPayamak()) {
      console.log(`📱 [SMS] Packed notice skipped for Melli Payamak pattern line: ${orderNumber}`);
      return;
    }

    if (!this.isConfigured()) {
      console.log(`📱 [SMS stub] Order packed: ${orderNumber} -> ${formatted}`);
      return;
    }

    if (packedPatternCode) {
      await this.sendPattern(packedPatternCode, { [orderAttribute]: orderNumber }, formatted);
      return;
    }

    await this.sendSimpleText(
      formatted,
      `سفارش ${orderNumber} آماده تحویل به پیک شد.\n${SITE_NAME}`
    );
  }

  /** Notify customer when courier is on the way. */
  async sendOrderShipped(recipient: string, orderNumber: string): Promise<void> {
    const formatted = this.formatRecipient(recipient);
    const { shippedPatternCode, orderAttribute } = config.sms.farazsms;

    if (this.usesMeliPayamak()) {
      console.log(`📱 [SMS] Shipped notice skipped for Melli Payamak pattern line: ${orderNumber}`);
      return;
    }

    if (!this.isConfigured()) {
      console.log(`📱 [SMS stub] Order shipped: ${orderNumber} -> ${formatted}`);
      return;
    }

    if (shippedPatternCode) {
      await this.sendPattern(shippedPatternCode, { [orderAttribute]: orderNumber }, formatted);
      return;
    }

    await this.sendSimpleText(
      formatted,
      `پیک ${SITE_NAME} حرکت کرد و به زودی به آدرس شما می‌رسد.\nسفارش: ${orderNumber}`
    );
  }

  /** Notify store operators about a brand-new order (uses admin settings). */
  async notifyOperatorsNewOrder(orderNumber: string, customerName: string): Promise<void> {
    try {
      const { settingsService } = await import('./settings.service');
      const { enabled, phones, messageTemplate } =
        await settingsService.resolveNewOrderSmsRecipients();
      if (!enabled || !phones.length) return;

      const text = messageTemplate
        .split('{orderNumber}')
        .join(orderNumber)
        .split('{customerName}')
        .join(customerName);

      await this.broadcast(phones, text);
    } catch (error) {
      console.error('Failed to notify operators of new order:', error);
    }
  }

  /** Broadcast message to multiple recipients. */
  async broadcast(recipients: string[], message: string): Promise<{ queued: number }> {
    const formatted = recipients.map((r) => this.formatRecipient(r));
    if (this.usesMeliPayamak()) {
      throw new AppError(400, 'خط خدماتی ملی‌پیامک فقط الگوی سفارش را می‌فرستد', 'SMS_PATTERN_ONLY');
    }

    if (!this.isConfigured()) {
      console.log(`📱 [SMS stub] Broadcast to ${formatted.length}: ${message.slice(0, 80)}`);
      return { queued: formatted.length };
    }

    const { lineNumber, numberFormat } = config.sms.farazsms;
    await this.postJson(FARAZSMS_SIMPLE_URL, {
      text: message,
      line_number: lineNumber,
      recipients: formatted,
      number_format: numberFormat,
      schedule: null,
    });

    return { queued: formatted.length };
  }
}

export const smsService = new SmsService();
