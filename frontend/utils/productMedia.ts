import type { Product } from '~/types';

/** همیشه در public موجود است (برخلاف jpg قدیمی). */
export const PRODUCT_IMAGE_PLACEHOLDER = '/images/placeholder-product.svg';

function resolveMediaUrl(image: string): string {
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/')) {
    const config = useRuntimeConfig();
    const baseUrl = config.public.apiBase.replace('/api', '');
    return `${baseUrl}${image}`;
  }
  return image;
}

/** تصاویر دمو — SVG محلی از سرور Nuxt؛ بدون اینترنت و بدون 404 خارجی. */
export function demoMediaUrl(key: string, width = 534, height = 800): string {
  const safe = key.replace(/[^a-zA-Z0-9-_]/g, '-');
  return `/demo-img/${safe}?w=${width}&h=${height}`;
}

export function collectProductImagePaths(product: Product): string[] {
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    if (!raw) return;
    const url = resolveMediaUrl(raw);
    if (!out.includes(url)) out.push(url);
  };
  push(product.image);
  for (const img of product.images ?? []) push(img);
  return out;
}

function localDemoPrimary(product: Product): string {
  return demoMediaUrl(`product-${product.slug || product.id}-primary`);
}

function localDemoHover(product: Product): string {
  return demoMediaUrl(`product-${product.slug || product.id}-hover`);
}

export function primaryProductImageUrl(product: Product): string {
  const paths = collectProductImagePaths(product);
  const first = paths[0];
  if (first && (first.startsWith('/demo-img/') || first.startsWith('/images/'))) return first;
  if (first && first.startsWith('/uploads/')) return first;
  if (first && first.startsWith('http')) return first;
  return localDemoPrimary(product);
}

/** تصویر دوم برای هاور — فقط اگر با تصویر اول فرق داشته باشد. */
export function hoverProductImageUrl(product: Product): string | null {
  const paths = collectProductImagePaths(product);
  if (paths.length >= 2) {
    const second = paths[1];
    if (second && second !== paths[0]) return second;
  }
  const hover = localDemoHover(product);
  const primary = primaryProductImageUrl(product);
  if (hover === primary) return null;
  return hover;
}
