const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
}

/** Invisible / bidi marks often present in pasted Persian text. */
const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

/** Words that appear in pasted titles/labels but rarely in product fields. */
const SEARCH_STOPWORDS = new Set([
  'کد',
  'کدمحصول',
  'محصول',
  'قیمت',
  'تومان',
  'ریال',
  'عدد',
  'بسته',
  'سایز',
  'رنگ',
  'از',
  'در',
  'به',
  'با',
  'برای',
  'و',
  'یا',
  'این',
  'آن',
  'یک',
  'the',
  'and',
  'of',
  'for',
]);

/** Normalize Persian/Arabic text for product search (typed or pasted). */
export function normalizeSearchText(value: string): string {
  return normalizeDigits(value)
    // ZWNJ is often a visual word break in pasted titles ("بافت‌کد" → "بافت کد")
    .replace(/\u200c/g, ' ')
    .replace(INVISIBLE_CHARS, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    // Punctuation / separators from pasted titles → space
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a query into meaningful search terms (drops stopwords / noise). */
export function searchTermsFromQuery(search: string): string[] {
  const normalized = normalizeSearchText(search);
  if (!normalized) return [];

  return normalized
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => {
      if (!term) return false;
      if (SEARCH_STOPWORDS.has(term)) return false;
      // Keep digit codes of any length; letters need 2+ chars
      if (/^\d+$/.test(term)) return term.length >= 1;
      return term.length >= 2;
    });
}

/** Variants so DB rows with Arabic ی/ک still match Persian keyboards. */
export function searchTermVariants(term: string): string[] {
  const base = normalizeSearchText(term);
  if (!base) return [];
  const variants = new Set<string>([base]);
  variants.add(base.replace(/ی/g, 'ي').replace(/ک/g, 'ك'));
  // Match DB rows that still contain ZWNJ between letters (paste vs type)
  if (/[\u0600-\u06FF]/.test(base) && base.length >= 2 && base.length <= 24) {
    variants.add(base.split('').join('\u200c'));
  }
  return [...variants];
}

export function normalizePhone(phone: string): string {
  let normalized = normalizeDigits(phone).replace(/\D/g, '');
  if (normalized.startsWith('98')) normalized = '0' + normalized.slice(2);
  if (!normalized.startsWith('0')) normalized = '0' + normalized;
  if (!/^09\d{9}$/.test(normalized)) {
    throw new Error('INVALID_PHONE');
  }
  return normalized;
}
