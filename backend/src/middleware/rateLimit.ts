import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const isDev = process.env.NODE_ENV !== 'production';

function isHealthPath(req: Request) {
  const path = req.path || req.url || '';
  return path.includes('/health');
}

function hasAuthHeader(req: Request) {
  const h = req.headers.authorization;
  return Boolean(h && h.startsWith('Bearer '));
}

/**
 * محدودیت‌های فعلی (production):
 * - عمومی: مهمان ۳۰۰۰ / لاگین‌شده ۸۰۰۰ در هر ۱۵ دقیقه
 * - ورود: ۵۰ تلاش در ۱۵ دقیقه
 * - OTP: ۵ درخواست در هر ۱ دقیقه
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    if (hasAuthHeader(req)) return 8_000;
    return 3_000;
  },
  message: {
    success: false,
    message: 'تعداد درخواست‌ها زیاد شد. حدود یک دقیقه صبر کنید و دوباره تلاش کنید.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isDev || isHealthPath(req),
  validate: { xForwardedForHeader: false },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 50,
  message: {
    success: false,
    message: 'تعداد تلاش‌های ورود بیش از حد مجاز است. کمی بعد دوباره امتحان کنید.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  validate: { xForwardedForHeader: false },
});

export const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 5,
  message: { success: false, message: 'لطفاً یک دقیقه صبر کنید و دوباره کد بخواهید' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  validate: { xForwardedForHeader: false },
});
