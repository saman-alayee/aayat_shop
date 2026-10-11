export const NATIONWIDE_SHIPPING_FEE = 135_000;

export const SHIPPING_OPTIONS = [
  {
    value: 'PICKUP',
    label: 'تحویل حضوری',
    hint: 'خرید آنلاین و تحویل در فروشگاه',
    fee: 0,
  },
  {
    value: 'NATIONWIDE',
    label: 'ارسال به سراسر ایران',
    hint: 'هزینه ارسال ۱۳۵ هزار تومان',
    fee: NATIONWIDE_SHIPPING_FEE,
  },
] as const;

export type ShippingMethod = (typeof SHIPPING_OPTIONS)[number]['value'];

export function shippingOption(value?: string | null) {
  return SHIPPING_OPTIONS.find((item) => item.value === value) ?? null;
}

const LEGACY_SHIPPING_LABELS: Record<string, string> = {
  FREE: 'ارسال رایگان / معمولی',
  JET: 'ارسال جت (فوری)',
};

export function shippingLabel(value?: string | null) {
  return shippingOption(value)?.label ?? (value ? LEGACY_SHIPPING_LABELS[value] : undefined) ?? 'نامشخص';
}
