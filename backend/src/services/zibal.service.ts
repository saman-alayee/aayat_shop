import prisma from '../config/database';
import { config } from '../config';
import { cacheDel } from '../config/redis';
import { AppError } from '../utils/errors';
import { cartService } from './cart.service';
import { notificationService } from './notification.service';

const REQUEST_URL = 'https://gateway.zibal.ir/v1/request';
const VERIFY_URL = 'https://gateway.zibal.ir/v1/verify';
const INQUIRY_URL = 'https://gateway.zibal.ir/v1/inquiry';

type PaymentDetails = {
  deliveryMethod?: string;
  deliveryFee?: number;
  provider?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  trackId?: string;
  refNumber?: string;
  sessionId?: string;
};

type ZibalResponse = {
  result?: number;
  message?: string;
  status?: number | string;
  trackId?: number | string;
  amount?: number;
  refNumber?: string | number;
};

function isPaidStatus(status: unknown): boolean {
  const value = String(status ?? '');
  return value === '1' || value === '2';
}

function asDetails(value: unknown): PaymentDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as PaymentDetails;
}

function callbackUrl(): string {
  if (config.zibal.callbackUrl) return config.zibal.callbackUrl;
  return `${config.apiPublicUrl}/api/payments/zibal/callback`;
}

/** Unpaid gateway orders older than this release stock so clothes are buyable again. */
const REVIEWING_TTL_MS = 45 * 60 * 1000;

export class ZibalService {
  private lastExpireReviewingAt = 0;

  assertConfigured() {
    if (!config.zibal.merchant) {
      throw new AppError(503, 'درگاه زیبال پیکربندی نشده است', 'ZIBAL_NOT_CONFIGURED');
    }
  }

  async requestPayment(order: {
    id: string;
    orderNumber: string;
    totalPrice: number;
    customerPhone: string;
  }): Promise<string> {
    this.assertConfigured();
    const amount = order.totalPrice * 10;
    if (!Number.isFinite(amount) || amount < 1000) {
      throw new AppError(400, 'مبلغ سفارش برای پرداخت زیبال کافی نیست');
    }

    let response: Response;
    try {
      response = await fetch(REQUEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: config.zibal.merchant,
          amount,
          callbackUrl: callbackUrl(),
          description: `سفارش ${order.orderNumber}`,
          orderId: order.orderNumber,
          mobile: order.customerPhone,
        }),
      });
    } catch (error) {
      console.error('Zibal request failed:', error);
      throw new AppError(502, 'اتصال به درگاه زیبال برقرار نشد', 'ZIBAL_REQUEST_FAILED');
    }

    const data = (await response.json().catch(() => ({}))) as ZibalResponse;
    if (!response.ok || data.result !== 100 || !data.trackId) {
      console.error('Zibal request rejected:', data.result, data.message);
      throw new AppError(502, 'شروع پرداخت زیبال ناموفق بود', 'ZIBAL_REQUEST_FAILED');
    }

    const current = await prisma.order.findUnique({ where: { id: order.id } });
    const details = asDetails(current?.paymentDetails);
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentDetails: {
          ...details,
          provider: 'zibal',
          paymentStatus: 'pending',
          trackId: String(data.trackId),
        },
      },
    });

    return `https://gateway.zibal.ir/start/${data.trackId}`;
  }

  async failOrder(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.status === 'CANCELLED') return;
    const details = asDetails(order.paymentDetails);
    if (details.paymentStatus === 'paid' || details.paymentStatus === 'failed') return;

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (!item.productId) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      if (order.couponId) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } },
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          paymentDetails: { ...details, provider: 'zibal', paymentStatus: 'failed' },
        },
      });
      await tx.orderStatusLog.create({
        data: { orderId: order.id, status: 'CANCELLED', note: 'پرداخت زیبال انجام نشد' },
      });
    });

    await cacheDel('products:*');
    await cacheDel('home:*');

    for (const item of order.items) {
      if (!item.productId) continue;
      await cartService
        .addItem(order.userId ?? undefined, details.sessionId, item.productId, item.quantity)
        .catch(() => undefined);
    }
  }

  async handleCallback(query: {
    success?: string;
    status?: string;
    trackId?: string;
    orderId?: string;
  }): Promise<string> {
    const orderNumber = query.orderId || '';
    const order = orderNumber
      ? await prisma.order.findUnique({ where: { orderNumber }, include: { items: true } })
      : null;

    const successPage = (number: string) =>
      `${config.frontendUrl}/orders/success?number=${encodeURIComponent(number)}&paid=1`;
    const failPage = `${config.frontendUrl}/checkout?payment=failed`;

    if (!order) return failPage;

    const details = asDetails(order.paymentDetails);
    if (details.paymentStatus === 'paid') return successPage(order.orderNumber);
    const callbackPaid = query.success === '1' && Boolean(query.trackId) && isPaidStatus(query.status);
    if (!callbackPaid) {
      console.error('Zibal callback rejected:', query.success, query.status, query.orderId);
      await this.failOrder(order.id);
      return `${failPage}&number=${encodeURIComponent(order.orderNumber)}`;
    }
    if (details.trackId && details.trackId !== String(query.trackId)) {
      await this.failOrder(order.id);
      return `${failPage}&number=${encodeURIComponent(order.orderNumber)}`;
    }

    let response: Response;
    try {
      response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: config.zibal.merchant,
          trackId: query.trackId,
        }),
      });
    } catch (error) {
      console.error('Zibal verify failed:', error);
      return `${failPage}&number=${encodeURIComponent(order.orderNumber)}`;
    }

    const data = (await response.json().catch(() => ({}))) as ZibalResponse;
    const verified = data.result === 100 || data.result === 201;
    const statusOk = data.status == null || data.status === '' || isPaidStatus(data.status);
    const expectedRial = order.totalPrice * 10;
    if (!verified || !statusOk || Number(data.amount) !== expectedRial) {
      console.error('Zibal verify rejected:', data.result, data.message);
      await this.failOrder(order.id);
      return `${failPage}&number=${encodeURIComponent(order.orderNumber)}`;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'NEW',
        paymentDetails: {
          ...details,
          provider: 'zibal',
          paymentStatus: 'paid',
          trackId: String(query.trackId),
          refNumber: data.refNumber != null ? String(data.refNumber) : undefined,
        },
      },
    });
    await prisma.orderStatusLog.create({
      data: { orderId: order.id, status: 'NEW', note: 'پرداخت شد و تا درخواست ارسال مشتری نگه داشته شد' },
    });

    if (order.userId) {
      await notificationService.notifyOrderStatusChange({
        userId: order.userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: 'NEW',
      });
    }

    return successPage(order.orderNumber);
  }

  /**
   * Recover paid orders stuck in REVIEWING (callback/verify race or network blip).
   * Uses verify (100/201) then inquiry so real payments reappear in «سبد ارسال».
   */
  async reconcilePendingOrder(orderId: string): Promise<'paid' | 'pending' | 'failed' | 'skip'> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'REVIEWING') return 'skip';
    const details = asDetails(order.paymentDetails);
    if (details.paymentStatus === 'paid') {
      await this.markOrderPaid(order.id, details);
      return 'paid';
    }
    if (!details.trackId || details.paymentStatus === 'failed') return 'skip';
    if (!config.zibal.merchant) return 'skip';

    const trackId = details.trackId;
    const expectedRial = order.totalPrice * 10;

    // verify: 100 = first OK, 201 = already verified
    try {
      const response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: config.zibal.merchant, trackId }),
      });
      const data = (await response.json().catch(() => ({}))) as ZibalResponse;
      const verified = data.result === 100 || data.result === 201;
      const statusOk = data.status == null || data.status === '' || isPaidStatus(data.status);
      const amountOk = data.amount == null || Number(data.amount) === expectedRial;
      if (verified && statusOk && amountOk) {
        await this.markOrderPaid(order.id, {
          ...details,
          trackId: String(trackId),
          refNumber: data.refNumber != null ? String(data.refNumber) : details.refNumber,
        });
        return 'paid';
      }
    } catch (error) {
      console.error('Zibal reconcile verify failed:', order.orderNumber, error);
    }

    try {
      const response = await fetch(INQUIRY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: config.zibal.merchant, trackId }),
      });
      const data = (await response.json().catch(() => ({}))) as ZibalResponse & {
        result?: number;
      };
      if ((data.result === 100 || data.result === 201) && isPaidStatus(data.status)) {
        const amountOk = data.amount == null || Number(data.amount) === expectedRial;
        if (amountOk) {
          await this.markOrderPaid(order.id, {
            ...details,
            trackId: String(trackId),
            refNumber: data.refNumber != null ? String(data.refNumber) : details.refNumber,
          });
          return 'paid';
        }
      }
    } catch (error) {
      console.error('Zibal reconcile inquiry failed:', order.orderNumber, error);
    }

    return 'pending';
  }

  async reconcilePendingForUser(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const phone = user?.phone;
    const pending = await prisma.order.findMany({
      where: {
        status: 'REVIEWING',
        OR: [{ userId }, ...(phone ? [{ customerPhone: phone }] : [])],
      },
      select: { id: true },
      take: 30,
      orderBy: { createdAt: 'desc' },
    });

    let paidCount = 0;
    for (const row of pending) {
      const result = await this.reconcilePendingOrder(row.id);
      if (result === 'paid') paidCount += 1;
    }
    return paidCount;
  }

  /**
   * Release stock locked by abandoned / reversed Zibal checkouts.
   * Tries reconcile first (in case money actually arrived), then cancels unpaid REVIEWING.
   */
  async expireStaleReviewingOrders(force = false): Promise<number> {
    const now = Date.now();
    if (!force && now - this.lastExpireReviewingAt < 60_000) return 0;
    this.lastExpireReviewingAt = now;

    const cutoff = new Date(now - REVIEWING_TTL_MS);
    const stale = await prisma.order.findMany({
      where: { status: 'REVIEWING', createdAt: { lt: cutoff } },
      select: { id: true, orderNumber: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 80,
    });
    if (!stale.length) return 0;

    let cancelled = 0;
    for (const row of stale) {
      try {
        const result = await this.reconcilePendingOrder(row.id);
        if (result === 'paid') continue;

        const still = await prisma.order.findUnique({
          where: { id: row.id },
          select: { status: true },
        });
        if (!still || still.status !== 'REVIEWING') continue;

        await this.failOrder(row.id);
        cancelled += 1;
      } catch (error) {
        console.error('expireStaleReviewingOrders failed:', row.orderNumber, error);
      }
    }

    if (cancelled > 0) {
      console.log(
        `Expired ${cancelled} stale REVIEWING order(s) older than ${REVIEWING_TTL_MS / 60000}m (stock restored)`
      );
    }
    return cancelled;
  }

  /** Customer abandons an unpaid gateway order — free the clothing for repurchase. */
  async abandonPendingOrder(orderId: string, userId: string): Promise<void> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError(404, 'سفارش یافت نشد');
    if (order.userId !== userId) throw new AppError(403, 'دسترسی غیرمجاز');
    if (order.status !== 'REVIEWING') {
      throw new AppError(400, 'فقط سفارش‌های منتظر پرداخت قابل لغو هستند');
    }

    const result = await this.reconcilePendingOrder(order.id);
    if (result === 'paid') {
      throw new AppError(400, 'پرداخت این سفارش تأیید شد؛ دیگر منتظر پرداخت نیست');
    }

    const still = await prisma.order.findUnique({
      where: { id: order.id },
      select: { status: true },
    });
    if (!still || still.status !== 'REVIEWING') {
      throw new AppError(400, 'وضعیت سفارش تغییر کرده است');
    }

    await this.failOrder(order.id);
  }

  private async markOrderPaid(orderId: string, details: PaymentDetails) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    if (order.status === 'NEW' || order.status === 'PREPARING' || order.status === 'SHIPPED') return;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'NEW',
        paymentDetails: {
          ...details,
          provider: 'zibal',
          paymentStatus: 'paid',
        },
      },
    });
    await prisma.orderStatusLog.create({
      data: {
        orderId,
        status: 'NEW',
        note: 'پرداخت با بررسی مجدد زیبال تأیید شد و به سبد ارسال برگشت',
      },
    });

    if (order.userId) {
      await notificationService.notifyOrderStatusChange({
        userId: order.userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: 'NEW',
      });
    }
  }
}

export const zibalService = new ZibalService();
