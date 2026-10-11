<script setup lang="ts">
import type { ClothingMeta, Product } from '~/types';

const props = defineProps<{
  product: Product;
  clothingMeta: ClothingMeta | null;
  isDemoProduct: boolean;
  inStockDisplay: boolean;
  canPurchase: boolean;
  quantity: number;
  favorited: boolean;
}>();

const selectedColor = defineModel<string | undefined>('selectedColor');
const selectedSize = defineModel<string | undefined>('selectedSize');

const emit = defineEmits<{
  addToCart: [];
  decreaseQty: [];
  increaseQty: [];
  removeFromCart: [];
  toggleFavorite: [];
}>();

const { formatPrice } = useFormat();

const category = computed(() => props.product.category);

function share(kind: 'whatsapp' | 'telegram' | 'twitter' | 'facebook') {
  if (!import.meta.client) return;
  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(props.product.name);
  const links = {
    whatsapp: `https://wa.me/?text=${text}%20${url}`,
    telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
  };
  window.open(links[kind], '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <div class="mt-5 flex min-w-0 flex-col md:mt-1">
    <nav class="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
      <NuxtLink to="/" class="hover:text-[#ef394e]">صفحه اصلی</NuxtLink>
      <template v-if="category?.name">
        <span>/</span>
        <NuxtLink
          v-if="category.slug"
          :to="`/categories/${category.slug}`"
          class="hover:text-[#ef394e]"
        >
          {{ category.name }}
        </NuxtLink>
        <span v-else>{{ category.name }}</span>
      </template>
    </nav>

    <div class="flex items-start gap-3">
      <h1 class="flex-1 text-[19px] font-bold leading-8 text-[#23254e] md:text-xl">
        {{ product.name }}
      </h1>
      <button
        type="button"
        class="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-400"
        :class="favorited ? 'border-red-200 text-[#ef394e]' : ''"
        aria-label="علاقه‌مندی"
        @click="emit('toggleFavorite')"
      >
        <AppIcon name="lucide:heart" size="sm" :class="favorited ? 'fill-current' : ''" />
      </button>
    </div>

    <div class="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
      <p class="text-[22px] font-bold leading-none text-[#23254e]">
        {{ formatPrice(product.effectivePrice) }}
      </p>
      <p v-if="product.discountPrice" class="text-sm text-gray-400 line-through">
        {{ formatPrice(product.price) }}
      </p>
    </div>

    <p v-if="isDemoProduct" class="mt-2 text-xs text-gray-500">موجود — فقط نمایشی</p>
    <p v-else-if="!inStockDisplay" class="mt-2 text-sm font-medium text-[#ef394e]">ناموجود</p>

    <div
      v-if="clothingMeta?.sizes?.length || clothingMeta?.colors?.length"
      class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <label v-if="clothingMeta?.sizes?.length" class="block">
        <span class="field-label">سایز</span>
        <select v-model="selectedSize" class="input-field">
          <option v-for="size in clothingMeta.sizes" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>

      <label v-if="clothingMeta?.colors?.length" class="block">
        <span class="field-label">رنگ</span>
        <select v-model="selectedColor" class="input-field">
          <option v-for="color in clothingMeta.colors" :key="color.name" :value="color.name">
            {{ color.name }}
          </option>
        </select>
      </label>
    </div>

    <div class="mt-5 hidden items-center gap-3 md:flex">
      <button
        type="button"
        class="inline-flex h-12 min-w-[190px] items-center justify-center rounded-lg bg-[#ef394e] px-6 text-sm text-white transition-colors hover:bg-[#d63245] disabled:cursor-not-allowed disabled:bg-gray-300"
        :disabled="!canPurchase"
        @click="emit('addToCart')"
      >
        {{ canPurchase ? 'افزودن به سبد خرید' : 'ناموجود' }}
      </button>

      <div v-if="quantity > 0" class="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1">
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center text-gray-600"
          aria-label="کم کردن"
          @click="quantity <= 1 ? emit('removeFromCart') : emit('decreaseQty')"
        >
          <AppIcon name="lucide:minus" size="sm" />
        </button>
        <span class="min-w-[1.5rem] text-center text-sm font-bold text-[#23254e]">{{ quantity }}</span>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center text-gray-600"
          aria-label="زیاد کردن"
          @click="emit('increaseQty')"
        >
          <AppIcon name="lucide:plus" size="sm" />
        </button>
      </div>
    </div>

    <div class="mt-4 flex items-center gap-2 text-gray-400">
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 hover:text-[#25D366]" aria-label="واتساپ" @click="share('whatsapp')">
        <AppIcon name="lucide:message-circle" size="sm" />
      </button>
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 hover:text-[#229ED9]" aria-label="تلگرام" @click="share('telegram')">
        <AppIcon name="lucide:send" size="sm" />
      </button>
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100" aria-label="ایکس" @click="share('twitter')">
        <AppIcon name="lucide:twitter" size="sm" />
      </button>
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 hover:text-[#1877F2]" aria-label="فیسبوک" @click="share('facebook')">
        <AppIcon name="lucide:facebook" size="sm" />
      </button>
    </div>

    <div
      v-if="product.description"
      class="mt-8 text-sm leading-8 text-[#3f4064] whitespace-pre-line"
    >
      {{ product.description }}
    </div>

    <div v-if="clothingMeta?.sizeGuide" class="mt-6 text-sm leading-8 text-[#3f4064] whitespace-pre-line">
      <p class="mb-1 font-bold text-[#23254e]">راهنمای سایز</p>
      {{ clothingMeta.sizeGuide }}
    </div>
  </div>
</template>
