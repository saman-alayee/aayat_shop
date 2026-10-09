import { SITE_NAME, SITE_DESCRIPTION } from '~/constants/site';

type PageSeoInput = {
  title?: string;
  description?: string;
  path?: string;
  image?: string | null;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

export function usePageSeo(input: MaybeRefOrGetter<PageSeoInput>) {
  const config = useRuntimeConfig();
  const route = useRoute();

  const resolved = computed(() => toValue(input));

  const title = computed(() => {
    const t = resolved.value.title?.trim();
    return t ? `${t} | ${SITE_NAME}` : SITE_NAME;
  });

  const description = computed(() => resolved.value.description?.trim() || SITE_DESCRIPTION);

  const canonicalPath = computed(() => resolved.value.path ?? route.path);

  useSeoMeta({
    title: () => title.value,
    description: () => description.value,
    ogTitle: () => title.value,
    ogDescription: () => description.value,
    ogType: 'website',
    ogLocale: 'fa_IR',
    robots: () => (resolved.value.noindex ? 'noindex, nofollow' : 'index, follow'),
  });

  useHead(() => ({
    link: [
      {
        rel: 'canonical',
        href: `${String(config.public.siteUrl || '').replace(/\/+$/, '')}${canonicalPath.value}`,
      },
    ],
    script: resolved.value.jsonLd
      ? [
          {
            type: 'application/ld+json',
            innerHTML: JSON.stringify(resolved.value.jsonLd),
          },
        ]
      : [],
  }));
}
