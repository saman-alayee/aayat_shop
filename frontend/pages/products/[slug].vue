<script setup lang="ts">
import type { Product } from '~/types';
import { SITE_NAME } from '~/constants/site';
import { effectiveProductStock, parseClothingMeta } from '~/utils/clothing';

const route = useRoute();
const api = useApi();
const catalogDemo = useCatalogDemo();
const cartStore = useCartStore();
const { formatPrice, getProductImage } = useFormat();
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
  <div v-if="product" class="bg-white pb-28 md:pb-12">
    <div v-if="isDemoProduct" class="mx-auto max-w-[1240px] px-4 pt-3">
      <AppAlertBanner variant="info" message="این محصول نمایشی است (تصاویر placeholder) — فقط برای پیش‌نمایش ظاهر فروشگاه." />
    </div>
    <div class="mx-auto max-w-[1240px] px-4 pb-4 md:py-8">
      <div class="md:grid md:grid-cols-[minmax(280px,440px)_minmax(0,1fr)] md:items-start md:gap-10 lg:gap-14">
        <ProductDetailGallery
          :images="galleryImages"
          :active-index="activeImageIndex"
          :product-name="product.name"
          @update:active-index="activeImageIndex = $event"
        />

        <ProductDetailSpecs
          :product="product"
          :clothing-meta="clothingMeta"
          v-model:selected-color="selectedColor"
          v-model:selected-size="selectedSize"
          :is-demo-product="isDemoProduct"
          :in-stock-display="inStockDisplay"
          :can-purchase="canPurchase"
          :quantity="quantity"
          :favorited="favorited"
          @add-to-cart="cartStore.addItem(product.id)"
          @decrease-qty="cartStore.updateQuantity(product.id, quantity - 1)"
          @increase-qty="cartStore.updateQuantity(product.id, quantity + 1)"
          @remove-from-cart="cartStore.removeItem(product.id)"
          @toggle-favorite="toggleFavorite(product.id)"
        />
      </div>
    </div>

    <section v-if="relatedProducts.length" class="mx-auto mt-6 max-w-[1240px] border-t border-gray-100 px-4 pb-6 pt-8">
      <h2 class="mb-4 text-base font-bold text-[#23254e]">محصولات مشابه</h2>
      <ProductCardList :products="relatedProducts" layout="strip" />
    </section>

    <div class="fixed inset-x-0 bottom-16 z-[55] border-t border-gray-100 bg-white px-4 py-3 md:hidden">
      <div class="mx-auto flex max-w-lg items-center gap-3">
        <button
          type="button"
          class="inline-flex h-12 flex-1 items-center justify-center rounded-lg bg-[#ef394e] px-4 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          :disabled="!canPurchase"
          @click="cartStore.addItem(product.id)"
        >
          {{ canPurchase ? 'افزودن به سبد خرید' : 'ناموجود' }}
        </button>
        <p class="shrink-0 text-base font-bold text-[#23254e]">
          {{ formatPrice(product.effectivePrice) }}
        </p>
      </div>
    </div>
  </div>
</template>
