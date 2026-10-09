<script setup lang="ts">
import type { Category, Product, Slider, HomeCategorySection } from '~/types';
import { SITE_DESCRIPTION, SITE_NAME } from '~/constants/site';

definePageMeta({ layout: 'home' });

const api = useApi();
const catalogDemo = useCatalogDemo();

const { data: categories } = await useAsyncData('categories', async () => {
  try {
    const { data } = await api.get<Category[]>('/categories');
    return catalogDemo.categoriesForStore(data);
  } catch {
    catalogDemo.markDemo(true);
    return catalogDemo.categoriesForStore([]);
  }
});

const { data: topSliders, refresh: refreshTopSliders } = await useAsyncData('sliders-top', async () => {
  try {
    const { data } = await api.get<Slider[]>('/sliders?placement=HOME_TOP');
    return data.filter((item) => item.isActive);
  } catch {
    return [] as Slider[];
  }
});

const newestProducts = ref<Product[]>([]);
const specialProducts = ref<Product[]>([]);
const categorySections = ref<HomeCategorySection[]>([]);
const sectionsLoading = ref(true);

const homeCategories = computed(() => categories.value ?? []);

const displayTopSliders = computed(() =>
  catalogDemo.slidersForStore(topSliders.value?.length ? topSliders.value : [])
);

/** ترتیب کالکشن مثل مرجع: مردانه، زنانه، پسرانه، دخترانه */
const collectionTiles = computed(() => {
  const list = homeCategories.value;
  const order = ['mardane', 'zanane', 'pesarane', 'dokhtarane'];
  const sorted = [...list].sort((a, b) => {
    const ia = order.indexOf(a.slug);
    const ib = order.indexOf(b.slug);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return sorted.length ? sorted : list;
});

async function loadHomeSections() {
  sectionsLoading.value = true;
  try {
    const [newestRes, dealRes, feedRes] = await Promise.all([
      api.get<{ products: Product[] }>('/products?sort=newest&limit=12').catch(() => ({ data: { products: [] } })),
      api.get<{ products: Product[] }>('/products?homeDeal=true&limit=12').catch(() => ({ data: { products: [] } })),
      api.get<HomeCategorySection[]>('/products/home-feed').catch(() => ({ data: [] as HomeCategorySection[] })),
    ]);
    newestProducts.value = newestRes.data.products;
    specialProducts.value = dealRes.data.products;
    if (!specialProducts.value.length) {
      const disc = await api
        .get<{ products: Product[] }>('/products?discounted=true&limit=12')
        .catch(() => ({ data: { products: [] } }));
      specialProducts.value = disc.data.products;
    }
    categorySections.value = feedRes.data;

    const needsDemo =
      catalogDemo.forceDemo.value ||
      (!newestProducts.value.length && !specialProducts.value.length && !categorySections.value.length);
    if (needsDemo) {
      catalogDemo.markDemo(true);
      newestProducts.value = catalogDemo.demoFeatured().slice(0, 12);
      specialProducts.value = catalogDemo.demoDiscounted().slice(0, 12);
      categorySections.value = catalogDemo.demoHomeFeed();
    }
  } finally {
    sectionsLoading.value = false;
  }
}

onMounted(() => {
  loadHomeSections();
  if (!topSliders.value?.length) refreshTopSliders();
});

usePageSeo({
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: useRuntimeConfig().public.siteUrl,
  },
});
</script>

<template>
  <div class="pb-10 bg-white">
    <HomeHeroSlider v-if="displayTopSliders.length" :sliders="displayTopSliders" />

    <CollectionTileGrid :categories="collectionTiles" />

    <section v-if="newestProducts.length" class="pt-8 md:pt-12 pb-6 md:pb-10">
      <HomeSection title="جدیدترین محصولات" to="/search?sort=newest" />
      <ProductCardList :products="newestProducts" layout="grid" density="sarak" />
    </section>

    <HomeBrandIntro />

    <section v-if="specialProducts.length" class="pt-2 pb-8 md:pb-12">
      <HomeSection title="پیشنهاد ویژه" to="/search?discounted=1" />
      <ProductCardList :products="specialProducts" layout="grid" density="sarak" />
    </section>

    <LoadingSpinner :show="sectionsLoading" />

    <template v-for="section in categorySections.slice(0, 2)" :key="section.category.id">
      <section v-if="section.products.length" class="pt-4 pb-8 md:pb-10">
        <HomeSection :title="section.category.name" :to="`/categories/${section.category.slug}`" />
        <ProductCardList :products="section.products.slice(0, 8)" layout="grid" density="sarak" />
      </section>
    </template>

    <NewsletterSection />
  </div>
</template>
