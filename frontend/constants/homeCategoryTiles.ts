/**
 * Legacy helpers — home tiles are now controlled by Category.showOnHome in admin.
 * Kept only so old imports (if any) do not break during transition.
 */
export const HOME_CATEGORY_TILES = [] as const;

export const HOME_CATEGORY_SLUGS = new Set<string>();

export function isHomeCategorySlug(_slug: string): boolean {
  return false;
}
