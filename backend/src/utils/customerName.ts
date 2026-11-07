import { normalizeDigits } from './normalize';

const LETTER_RE = /[\u0600-\u06FF\u0750-\u077Fa-zA-Z]/u;

function normalizePhone(phone: string): string {
  let normalized = normalizeDigits(phone).replace(/\D/g, '');
  if (normalized.startsWith('98')) normalized = `0${normalized.slice(2)}`;
  if (normalized && !normalized.startsWith('0')) normalized = `0${normalized}`;
  return normalized;
}

export function splitCustomerName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/** Returns error message or null if valid. */
export function validateCustomerName(rawName: string, phone?: string): string | null {
  const name = rawName.replace(/\s+/g, ' ').trim();
  if (name.length < 3) return 'نام و نام خانوادگی را وارد کنید';

  const digitsOnly = normalizeDigits(name).replace(/\D/g, '');
  if (digitsOnly.length >= 8) return 'به‌جای شماره، نام و نام خانوادگی بنویسید';

  if (phone) {
    const normalizedPhone = normalizePhone(phone);
    const nameAsPhone = normalizePhone(name);
    if (normalizedPhone && nameAsPhone === normalizedPhone) {
      return 'به‌جای شماره، نام و نام خانوادگی بنویسید';
    }
  }

  const words = name.split(' ').filter(Boolean);
  if (words.length < 2) return 'نام و نام خانوادگی را کامل بنویسید (مثلاً: زهرا محمدی)';

  const letterCount = [...name].filter((ch) => LETTER_RE.test(ch)).length;
  if (letterCount < 4) return 'نام معتبر وارد کنید';

  for (const word of words) {
    const wordLetters = [...word].filter((ch) => LETTER_RE.test(ch)).length;
    if (wordLetters < 2) return 'نام و نام خانوادگی را کامل و درست بنویسید';
  }

  return null;
}
