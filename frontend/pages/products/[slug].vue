<script setup lang="ts">
import type { Product } from '~/types';
import { SITE_NAME } from '~/constants/site';
import {
  colorSwatchStyle,
  effectiveProductStock,
  parseClothingMeta,
} from '~/utils/clothing';

const route = useRoute();
const api = useApi();
const catalogDemo = useCatalogDemo();
const cartStore = useCartStore();
const { formatPrice, getProductImage, resolveMediaUrl } = useFormat();
const { isFavorite, toggleFavorite } = useFavorites();

const slug = route.params.slug as string;

const { data: product } = await useAsyncData(`product-${slug}`, async () => {
  const demoFirst = catalogDemo.forceDemo.value || slug.startsWith('demo-');
  if (demoFirst) {
    const demo = catalogDemo.demoProduct(slug);
    if (demo) {
      catalogDemo.markDemo(true);
      return demo;
    }
  }
  try {
    const { data } = await api.get<Product>(`/products/${slug}`);
    return data;
  } catch {
    const demo = catalogDemo.demoProduct(slug);
    if (demo) catalogDemo.markDemo(true);
    return demo;
  }
});

const isDemoProduct = computed(
  () => !!product.value && catalogDemo.isDemoProductId(product.value.id)
);

const relatedProducts = ref<Product[]>([]);

const quantity = computed(() => cartStore.getItemQuantity(product.value?.id ?? ''));
const favorited = computed(() => (product.value ? isFavorite(product.value.id) : false));

const galleryImages = computed(() => {
  if (!product.value) return [] as string[];
  if (product.value.images?.length) return product.value.images;
  return product.value.image ? [product.value.image] : [];
});

const activeImageIndex = ref(0);
const activeImage = computed(() => galleryImages.value[activeImageIndex.value] ?? null);

const clothingMeta = computed(() => (product.value ? parseClothingMeta(product.value) : null));
const selectedColor = ref<string | undefined>();
const selectedSize = ref<string | undefined>();

watch(clothingMeta, (meta) => {
  selectedColor.value = meta?.colors?.[0]?.name;
  selectedSize.value = meta?.sizes?.[0];
});

watch(selectedColor, (color) => {
  const meta = clothingMeta.value;
  const swatch = meta?.colors?.find((c) => c.name === color);
  if (swatch?.imageIndex != null && swatch.imageIndex < galleryImages.value.length) {
    activeImageIndex.value = swatch.imageIndex;
  }
});

const variantStock = computed(() => {
  if (!product.value) return 0;
  return effectiveProductStock(product.value, selectedColor.value, selectedSize.value);
});

const inStockDisplay = computed(() => variantStock.value > 0);
const canPurchase = computed(() => !isDemoProduct.value && inStockDisplay.value);

watch(galleryImages, (images) => {
  if (activeImageIndex.value >= images.length) {
    activeImageIndex.value = 0;
  }
});

async function buyNow() {
  if (!product.value || !canPurchase.value) return;
  await cartStore.addItem(product.value.id);
  navigateTo('/checkout');
}

async function loadRelated() {
  if (!product.value) return;
  if (isDemoProduct.value) {
    relatedProducts.value = catalogDemo.demoRelated(slug, 12);
    return;
  }
  try {
    const { data } = await api.get<Product[]>(`/products/${slug}/related?limit=12`);
    relatedProducts.value = data;
  } catch {
    relatedProducts.value = catalogDemo.demoRelated(slug, 12);
  }
}

onMounted(async () => {
  await loadRelated();
});

watch(product, loadRelated);

usePageSeo(() => ({
  title: product.value?.name || 'محصول',
  description: product.value?.description?.slice(0, 160) || undefined,
  path: product.value ? `/products/${product.value.slug}` : undefined,
  jsonLd: product.value
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.value.name,
        description: product.value.description || undefined,
        image: galleryImages.value.map((img) => getProductImage(img)),
        offers: {
          '@type': 'Offer',
          price: product.value.effectivePrice,
          priceCurrency: 'IRR',
          availability: canPurchase.value
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        },
      }
    : undefined,
}));
</script>

<template>
  <div v-if="product" class="pb-28 md:pb-10">
    <div v-if="isDemoProduct" class="max-w-6xl mx-auto px-4 pt-3">
      <AppAlertBanner variant="info" message="این محصول نمایشی است (تصاویر Unsplash) — فقط برای پیش‌نمایش ظاهر فروشگاه." />
    </div>
    <div class="max-w-6xl mx-auto px-4 py-4 md:py-8">
      <div class="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-10 lg:gap-14 md:items-start">
        <!-- Gallery -->
        <div class="md:sticky md:top-20">
          <div class="relative mx-auto w-full max-w-[420px] md:max-w-none">
            <div class="relative aspect-[4/5] overflow-hidden rounded-none md:rounded-sm bg-gray-50 ring-1 ring-gray-100">
              <img
                :src="getProductImage(activeImage)"
                :alt="product.name"
                class="h-full w-full object-contain p-3 md:p-6"
              />
              <button
                type="button"
                :class="[
                  'absolute top-3 end-3 z-10 flex h-10 w-10 items-center justify-center rounded-full shadow-md transition-colors',
                  favorited ? 'bg-red-50 text-red-500' : 'bg-white/95 text-gray-400 hover:text-red-400',
                ]"
                @click="toggleFavorite(product.id)"
              >
                <AppIcon name="lucide:heart" size="md" :class="favorited ? 'fill-current' : ''" />
              </button>
              <span
                v-if="product.discountPercent > 0"
                class="absolute top-3 start-3 z-10 rounded-lg bg-red-500 px-2.5 py-1 text-xs font-bold text-white"
              >
                {{ product.discountPercent }}٪ تخفیف
              </span>
            </div>

            <div
              v-if="galleryImages.length > 1"
              class="mt-3 flex gap-2 overflow-x-auto scrollbar-hide px-0.5"
            >
              <button
                v-for="(image, index) in galleryImages"
                :key="`${image}-${index}`"
                type="button"
                :class="[
                  'h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white md:h-[72px] md:w-[72px]',
                  activeImageIndex === index ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-200',
                ]"
                @click="activeImageIndex = index"
              >
                <img
                  :src="resolveMediaUrl(image)"
                  :alt="`${product.name} ${index + 1}`"
                  class="h-full w-full object-cover"
                />
              </button>
            </div>
          </div>
        </div>

        <!-- Details -->
        <div class="mt-5 md:mt-0 flex flex-col min-w-0">
          <div v-if="product.category?.name" class="mb-2">
            <NuxtLink
              v-if="product.category.slug"
              :to="`/categories/${product.category.slug}`"
              class="text-xs font-medium text-gray-500 hover:text-primary-600"
            >
              {{ product.category.name }}
            </NuxtLink>
          </div>

          <div v-if="product.tag?.name" class="mb-2">
            <NuxtLink
              v-if="product.category?.slug && product.tag.slug"
              :to="`/categories/${product.category.slug}?tag=${product.tag.slug}`"
              class="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
            >
              <span>{{ product.tag.icon }}</span>
              {{ product.tag.name }}
            </NuxtLink>
            <p v-else class="text-xs font-medium text-primary-600">
              {{ product.tag.icon }} {{ product.tag.name }}
            </p>
          </div>

          <h1 class="text-xl md:text-2xl lg:text-[1.65rem] font-bold text-gray-900 leading-snug">
            {{ product.name }}
          </h1>
          <div v-if="product.isNew || product.isOldPrice" class="mt-2 flex flex-wrap gap-2">
            <span
              v-if="product.isNew"
              class="inline-flex items-center rounded-lg bg-accent-500 px-2.5 py-1 text-xs font-bold text-white"
            >
              جدید
            </span>
            <span
              v-if="product.isOldPrice"
              class="inline-flex items-center rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-bold text-white"
            >
              قیمت قدیم
            </span>
          </div>
          <p v-if="clothingMeta?.fabric || product.unit" class="mt-1.5 text-sm text-gray-500">
            {{ clothingMeta?.fabric || product.unit }}
          </p>

          <div v-if="clothingMeta?.colors?.length" class="mt-5">
            <p class="text-xs font-semibold text-gray-800 mb-2">رنگ</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in clothingMeta.colors"
                :key="color.name"
                type="button"
                :class="[
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
                  selectedColor === color.name ? 'border-primary-700 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-700',
                ]"
                @click="selectedColor = color.name"
              >
                <span class="h-3.5 w-3.5 rounded-full ring-1 ring-gray-200" :style="colorSwatchStyle(color.hex)" />
                {{ color.name }}
              </button>
            </div>
          </div>

          <div v-if="clothingMeta?.sizes?.length" class="mt-4">
            <p class="text-xs font-semibold text-gray-800 mb-2">سایز</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="size in clothingMeta.sizes"
                :key="size"
                type="button"
                :class="[
                  'min-w-[2.5rem] rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                  selectedSize === size ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-200 text-gray-800 hover:border-gray-400',
                ]"
                @click="selectedSize = size"
              >
                {{ size }}
              </button>
            </div>
          </div>

          <div class="mt-5 rounded-2xl border border-gray-100 bg-white p-4 md:p-5 shadow-sm">
            <div class="flex flex-wrap items-end gap-x-3 gap-y-1">
              <p class="text-2xl md:text-3xl font-bold text-gray-900">
                {{ formatPrice(product.effectivePrice) }}
              </p>
              <p v-if="product.discountPrice" class="text-sm md:text-base text-gray-400 line-through pb-0.5">
                {{ formatPrice(product.price) }}
              </p>
            </div>

            <p v-if="isDemoProduct" class="mt-2 text-sm font-medium text-gray-600">موجود — فقط نمایشی</p>
            <p v-else-if="inStockDisplay" class="mt-2 text-sm font-medium text-green-700">
              موجود{{ variantStock < 5 && variantStock > 0 ? ` (تنها ${variantStock} عدد)` : '' }}
            </p>
            <p v-else class="mt-2 text-sm font-medium text-red-500">ناموجود</p>

            <!-- Desktop purchase -->
            <div v-if="canPurchase" class="hidden md:block mt-5 pt-5 border-t border-gray-100">
              <div v-if="quantity === 0" class="flex gap-3">
                <button class="btn-primary flex-1 min-h-[48px]" @click="cartStore.addItem(product.id)">
                  افزودن به سبد
                </button>
                <button class="btn-secondary flex-1 min-h-[48px]" @click="buyNow">
                  خرید و پرداخت
                </button>
              </div>
              <div v-else class="flex items-center gap-3">
                <div class="flex flex-1 items-center justify-center gap-4 rounded-xl bg-primary-50 px-4 py-2.5">
                  <button
                    type="button"
                    class="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary-600 shadow-sm"
                    @click="quantity <= 1 ? cartStore.removeItem(product.id) : cartStore.updateQuantity(product.id, quantity - 1)"
                  >
                    <AppIcon name="lucide:minus" size="md" />
                  </button>
                  <span class="min-w-[2rem] text-center text-xl font-bold text-primary-700">{{ quantity }}</span>
                  <button
                    type="button"
                    class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm"
                    @click="cartStore.updateQuantity(product.id, quantity + 1)"
                  >
                    <AppIcon name="lucide:plus" size="md" />
                  </button>
                </div>
                <button type="button" class="btn-primary shrink-0 min-h-[48px] px-6" @click="navigateTo('/checkout')">
                  تسویه حساب
                </button>
              </div>
            </div>

            <div v-else class="hidden md:block mt-5 pt-5 border-t border-gray-100">
              <button type="button" class="btn-secondary w-full min-h-[48px] opacity-70 cursor-not-allowed" disabled>
                اتمام موجودی
              </button>
            </div>
          </div>

          <div v-if="product.description" class="mt-6">
            <h2 class="text-sm font-bold text-gray-800 mb-2">توضیحات</h2>
            <p class="text-sm md:text-[15px] text-gray-600 leading-relaxed whitespace-pre-line">
              {{ product.description }}
            </p>
          </div>

          <div v-if="clothingMeta?.sizeGuide" class="mt-6">
            <h2 class="text-sm font-bold text-gray-800 mb-2">راهنمای سایز</h2>
            <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{{ clothingMeta.sizeGuide }}</p>
          </div>
        </div>
      </div>
    </div>

    <section v-if="relatedProducts.length" class="max-w-6xl mx-auto px-4 pb-6 mt-2 md:mt-4">
      <h2 class="section-title">
        {{ product.tag?.name ? `سایر ${product.tag.name}` : 'محصولات مرتبط' }}
      </h2>
      <ProductCardList :products="relatedProducts" layout="strip" />
    </section>

    <!-- Mobile fixed bar -->
    <div
      v-if="canPurchase"
      class="md:hidden fixed bottom-16 inset-x-0 z-[55] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 bg-white/95 backdrop-blur border-t border-gray-100"
    >
      <div class="max-w-lg mx-auto">
        <div v-if="quantity === 0" class="flex gap-2">
          <button class="btn-primary flex-1 min-h-[52px]" @click="cartStore.addItem(product.id)">
            افزودن به سبد
          </button>
          <button class="btn-secondary flex-1 min-h-[52px]" @click="buyNow">
            خرید و پرداخت
          </button>
        </div>
        <div v-else class="flex items-center gap-2">
          <div class="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-primary-50 p-3">
            <button
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-primary-600 shadow-sm"
              @click="quantity <= 1 ? cartStore.removeItem(product.id) : cartStore.updateQuantity(product.id, quantity - 1)"
            >
              <AppIcon name="lucide:minus" size="md" />
            </button>
            <span class="w-8 text-center text-xl font-bold text-primary-700">{{ quantity }}</span>
            <button
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm"
              @click="cartStore.updateQuantity(product.id, quantity + 1)"
            >
              <AppIcon name="lucide:plus" size="md" />
            </button>
          </div>
          <button type="button" class="btn-primary shrink-0 min-h-[52px] px-4" @click="navigateTo('/checkout')">
            تسویه حساب
          </button>
        </div>
      </div>
    </div>

    <div
      v-else
      class="md:hidden fixed bottom-16 inset-x-0 z-[55] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 bg-white/95 backdrop-blur border-t border-gray-100"
    >
      <div class="max-w-lg mx-auto">
        <button type="button" class="btn-secondary w-full min-h-[52px] opacity-70 cursor-not-allowed" disabled>
          اتمام موجودی
        </button>
      </div>
    </div>
  </div>
</template>
