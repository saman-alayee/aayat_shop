const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

/** Invisible / bidi marks often present in pasted Persian text. */
const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
}

/** Strip clipboard junk without rewriting punctuation mid-typing. */
export function stripInvisibleChars(value: string): string {
  return value.replace(INVISIBLE_CHARS, '');
}

/** Clean search box input before sending to API / URL (paste & submit). */
export function normalizeSearchText(value: string): string {
  return normalizeDigits(value)
    // ZWNJ is often a visual word break in pasted titles ("بافت‌کد" → "بافت کد")
    .replace(/\u200c/g, ' ')
    .replace(INVISIBLE_CHARS, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePhoneInput(phone: string): string {
  let normalized = normalizeDigits(phone).replace(/\D/g, '');
  if (normalized.startsWith('98')) normalized = '0' + normalized.slice(2);
  if (normalized && !normalized.startsWith('0')) normalized = '0' + normalized;
  return normalized;
}
