<script setup lang="ts">
import type { Product, HomeCategorySection, Slider } from '~/types';
import { SITE_DESCRIPTION, SITE_NAME } from '~/constants/site';

definePageMeta({ layout: 'home' });

const api = useApi();
const catalogDemo = useCatalogDemo();

const newestProducts = ref<Product[]>([]);
const specialProducts = ref<Product[]>([]);
const categorySections = ref<HomeCategorySection[]>([]);
const sectionsLoading = ref(true);

const WP_HERO: Slider[] = [
  {
    id: 'wp-hero-1',
    title: null,
    image: '/wp-home/hero-1.webp',
    linkUrl: '/categories/paperbacks-and-shirts',
    sortOrder: 1,
    placement: 'HOME_TOP',
    isActive: true,
  },
  {
    id: 'wp-hero-2',
    title: null,
    image: '/wp-home/hero-2.webp',
    linkUrl: '/categories/woman-clothe',
    sortOrder: 2,
    placement: 'HOME_TOP',
    isActive: true,
  },
];

const displayTopSliders = computed(() => WP_HERO);

async function loadHomeSections() {
  sectionsLoading.value = true;
  try {
    const [newestRes, specialRes, feedRes] = await Promise.all([
      api.get<{ products: Product[] }>('/products?sort=newest&limit=12'),
      api.get<{ products: Product[] }>('/products?discounted=1&limit=12'),
      api.get<HomeCategorySection[]>('/products/home-feed'),
    ]);

    const newest = newestRes.data?.products ?? [];
    const special = specialRes.data?.products ?? [];
    const feed = feedRes.data ?? [];

    if (catalogDemo.useDemoForApi(newest.length > 0)) {
      newestProducts.value = catalogDemo.demoFeatured().slice(0, 12);
      specialProducts.value = catalogDemo.demoDiscounted().slice(0, 12);
      categorySections.value = catalogDemo.demoHomeFeed();
    } else {
      newestProducts.value = newest;
      specialProducts.value = special.length ? special : newest.filter((p) => (p.discountPrice ?? 0) > 0);
      categorySections.value = feed;
    }
  } catch {
    catalogDemo.markDemo(false);
    newestProducts.value = [];
    specialProducts.value = [];
    categorySections.value = [];
  } finally {
    sectionsLoading.value = false;
  }
}

onMounted(() => {
  loadHomeSections();
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
    <HomeHeroSlider v-if="displayTopSliders.length" :sliders="displayTopSliders" :autoplay-ms="5000" layout="banner" />

    <HomeWpCategoryBanners />

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
