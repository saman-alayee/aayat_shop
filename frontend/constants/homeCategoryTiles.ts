/** دسته‌هایی که روی صفحه اول به‌صورت کارت تصویر نمایش داده می‌شوند. */
export const HOME_CATEGORY_TILES = [
  { slug: 't-shirt', fallbackImage: '/wp-home/categories/tshirt.png' },
  { slug: 'paperbacks-and-shirts', fallbackImage: '/wp-home/categories/blouse.png' },
  { slug: 'pants', fallbackImage: '/wp-home/categories/pants.png' },
  { slug: 'overalls', fallbackImage: '/wp-home/categories/overalls.png' },
  { slug: 'knitted-blouse', fallbackImage: '/wp-home/categories/knitted-blouse.png' },
  { slug: 'beach-shirt', fallbackImage: '/wp-home/categories/dress.png' },
  { slug: 'coat', fallbackImage: '/wp-home/categories/coat.png' },
] as const;

export const HOME_CATEGORY_SLUGS = new Set(HOME_CATEGORY_TILES.map((tile) => tile.slug));

export function isHomeCategorySlug(slug: string): boolean {
  return (HOME_CATEGORY_SLUGS as Set<string>).has(slug);
}
