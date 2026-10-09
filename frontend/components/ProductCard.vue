<script setup lang="ts">
import type { Product } from '~/types';
import { STORE_MODE } from '~/constants/site';
import { parseClothingMeta } from '~/utils/clothing';

const props = withDefaults(
  defineProps<{ product: Product; size?: 'default' | 'compact' | 'sarak' }>(),
  { size: 'default' }
);

const isClothingStore = STORE_MODE === 'clothing';
const fabricLabel = computed(
  () => parseClothingMeta(props.product)?.fabric || props.product.unit || '\u00A0'
);

const cartStore = useCartStore();
const { formatPriceCompact, getProductImage } = useFormat();
const { isFavorite, toggleFavorite } = useFavorites();

const isCompact = computed(() => props.size === 'compact');
const isSarak = computed(() => props.size === 'sarak');

const clothingMeta = computed(() => parseClothingMeta(props.product));
const colorLabels = computed(() => clothingMeta.value?.colors?.map((c) => c.name).slice(0, 4) ?? []);

const cardImages = useProductCardImages(toRef(props, 'product'));
const sarakMediaRef = ref<HTMLElement | null>(null);

let sarakImageObserver: IntersectionObserver | null = null;

onMounted(() => {
  if (!isSarak.value) return;
  nextTick(() => {
    const el = sarakMediaRef.value;
    if (!el || typeof IntersectionObserver === 'undefined') {
      cardImages.preloadHover();
      return;
    }
    sarakImageObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          cardImages.preloadHover();
          sarakImageObserver?.disconnect();
          sarakImageObserver = null;
        }
      },
      { rootMargin: '160px 0px' }
    );
    sarakImageObserver.observe(el);
  });
});

onUnmounted(() => {
  sarakImageObserver?.disconnect();
  sarakImageObserver = null;
});

const quantity = computed(() => cartStore.getItemQuantity(props.product.id));
const isAdding = computed(() => cartStore.addingProductId === props.product.id);
const favorited = computed(() => isFavorite(props.product.id));
const favLoading = ref(false);

const heartIconClass = computed(() =>
  favorited.value ? 'text-red-500 fill-red-500 stroke-red-500' : 'text-gray-500 fill-none stroke-current'
);

async function handleFavorite(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  if (favLoading.value) return;
  favLoading.value = true;
  try {
    await toggleFavorite(props.product.id);
  } finally {
    favLoading.value = false;
  }
}

async function handleAdd(event?: Event) {
  event?.preventDefault();
  event?.stopPropagation();
  await cartStore.addItem(props.product.id);
}

async function handleIncrease(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  await cartStore.updateQuantity(props.product.id, quantity.value + 1);
}

async function handleDecrease(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  if (quantity.value <= 1) {
    await cartStore.removeItem(props.product.id);
  } else {
    await cartStore.updateQuantity(props.product.id, quantity.value - 1);
  }
}


</script>

<template>
  <!-- سبک sarak-co.com -->
  <article v-if="isSarak" class="product-card product-card--sarak flex h-full w-full flex-col bg-white">
    <NuxtLink
      ref="sarakMediaRef"
      :to="`/products/${product.slug}`"
      class="product-card-sarak-media relative block aspect-[354/531] w-full overflow-hidden bg-neutral-100"
      draggable="false"
      @mouseenter="cardImages.preloadHover()"
      @focusin="cardImages.preloadHover()"
    >
      <img
        :src="cardImages.primarySrc"
        :alt="product.name"
        class="product-card-sarak-img-primary absolute inset-0 h-full w-full object-cover object-center"
        :class="[
          cardImages.hoverSrc ? 'product-card-sarak-img-primary--swap' : 'product-card-sarak-img-primary--zoom',
          cardImages.hoverEnabled ? 'product-card-sarak-img-primary--hide-on-hover' : '',
        ]"
        loading="lazy"
        decoding="async"
        draggable="false"
        @error="cardImages.onPrimaryError()"
      />
      <img
        v-if="cardImages.hoverSrc"
        :src="cardImages.hoverSrc"
        :alt="product.name"
        class="product-card-sarak-img-hover absolute inset-0 h-full w-full object-cover object-center"
        :class="cardImages.hoverEnabled ? 'product-card-sarak-img-hover--ready' : ''"
        loading="lazy"
        decoding="async"
        draggable="false"
        @error="cardImages.onHoverError()"
      />

      <div
        v-if="colorLabels.length"
        class="product-card-sarak-colors pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap gap-x-3 gap-y-1 px-3 pb-3 pt-12"
      >
        <span
          v-for="label in colorLabels"
          :key="label"
          class="text-xs font-normal leading-none text-white"
        >
          {{ label }}
        </span>
      </div>
    </NuxtLink>

    <div class="flex flex-col pt-3 pb-1 min-h-[4.5rem]">
      <NuxtLink
        :to="`/products/${product.slug}`"
        class="text-sm font-normal leading-snug text-black line-clamp-2 hover:opacity-80 transition-opacity"
        draggable="false"
      >
        {{ product.name }}
      </NuxtLink>

      <div class="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-sm font-normal leading-tight">
        <span
          v-if="product.discountPrice"
          class="price-text text-neutral-400 line-through decoration-neutral-400"
        >
          {{ formatPriceCompact(product.price) }}
        </span>
        <span class="price-text text-black">{{ formatPriceCompact(product.effectivePrice) }}</span>
        <span class="text-sm font-normal text-neutral-500">تومان</span>
      </div>
    </div>
  </article>

  <!-- سبک فروشگاه قبلی -->
  <div
    v-else
    :class="[
      'product-card group relative flex h-full w-full flex-col overflow-hidden bg-white',
      isCompact ? 'rounded-lg border border-gray-100/90' : 'rounded-xl border border-gray-100',
    ]"
  >
    <div class="relative shrink-0 overflow-hidden bg-neutral-50 aspect-[4/5]">
      <NuxtLink :to="`/products/${product.slug}`" class="block h-full w-full" draggable="false">
        <img
          :src="getProductImage(product.image)"
          :alt="product.name"
          class="pointer-events-none h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          draggable="false"
          @error="(e) => { const t = e.target as HTMLImageElement; if (t) t.src = '/images/placeholder-product.svg' }"
        />
      </NuxtLink>

      <div
        v-if="product.discountPercent > 0"
        :class="[
          'absolute z-10 font-bold text-white bg-red-500',
          isCompact ? 'top-0 start-0 rounded-ee-lg px-1.5 py-0.5 text-[9px]' : 'top-0 start-0 rounded-ee-xl px-2 py-1 text-[10px]',
        ]"
      >
        {{ product.discountPercent }}٪
      </div>

      <div
        v-if="product.isNew || product.isOldPrice"
        class="absolute top-0 end-0 z-10 flex flex-col items-end gap-0.5"
      >
        <div
          v-if="product.isNew"
          :class="[
            'font-bold text-white bg-accent-500',
            isCompact ? 'rounded-es-lg px-1.5 py-0.5 text-[9px]' : 'rounded-es-xl px-2 py-1 text-[10px]',
          ]"
        >
          جدید
        </div>
        <div
          v-if="product.isOldPrice"
          :class="[
            'font-bold text-white bg-amber-600',
            isCompact ? 'rounded-es-lg px-1.5 py-0.5 text-[8px] leading-tight' : 'rounded-es-xl px-2 py-1 text-[10px]',
          ]"
        >
          قیمت قدیم
        </div>
      </div>

      <button
        type="button"
        :class="[
          'absolute z-20 flex items-center justify-center rounded-full shadow-sm transition-all bg-white/95',
          isCompact
            ? 'bottom-1.5 start-1.5 h-6 w-6'
            : 'bottom-2 end-2 h-8 w-8 hover:bg-white',
          favorited ? 'ring-1 ring-red-100' : '',
        ]"
        :disabled="favLoading"
        aria-label="علاقه‌مندی"
        @click="handleFavorite"
      >
        <AppIcon
          name="lucide:heart"
          :size="isCompact ? 'xs' : 'sm'"
          :class="[heartIconClass, favorited ? 'product-card-heart-active' : '']"
        />
      </button>

      <div v-if="isCompact && !isClothingStore" class="absolute bottom-1.5 end-1.5 z-20">
        <div v-if="!product.inStock" class="rounded bg-white/95 px-1.5 py-0.5 text-[8px] font-medium text-red-500">
          ناموجود
        </div>
        <div v-else-if="quantity === 0">
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white shadow-md transition-all hover:bg-primary-700 active:scale-95"
            :disabled="isAdding"
            @click="handleAdd"
          >
            <AppIcon v-if="!isAdding" name="lucide:plus" size="xs" />
            <AppIcon v-else name="lucide:loader-2" size="xs" class="animate-spin" />
          </button>
        </div>
        <div v-else class="flex items-center rounded-full bg-white/95 shadow-md ring-1 ring-primary-100">
          <button type="button" class="flex h-6 w-6 items-center justify-center text-primary-600" @click="handleDecrease">
            <AppIcon name="lucide:minus" size="xs" />
          </button>
          <span class="min-w-[14px] text-center text-[10px] font-bold text-primary-700">{{ quantity }}</span>
          <button type="button" class="flex h-6 w-6 items-center justify-center text-primary-600" @click="handleIncrease">
            <AppIcon name="lucide:plus" size="xs" />
          </button>
        </div>
      </div>
    </div>

    <div
      :class="
        isCompact ? 'flex flex-1 flex-col px-2 pb-2 pt-1.5' : 'flex flex-1 flex-col px-3 pb-3 pt-2.5'
      "
    >
      <NuxtLink
        :to="`/products/${product.slug}`"
        :class="isCompact ? 'block h-[1.85rem] shrink-0' : 'block h-[2.6rem] shrink-0'"
        draggable="false"
      >
        <h3
          :class="[
            'line-clamp-2 font-medium text-gray-800',
            isCompact ? 'text-[11px] leading-[0.925rem]' : 'text-sm leading-[1.125rem]',
          ]"
        >
          {{ product.name }}
        </h3>
      </NuxtLink>

      <p
        v-if="!isCompact"
        class="mt-1 h-[15px] shrink-0 truncate text-[11px] leading-[15px] text-gray-400"
      >
        {{ fabricLabel }}
      </p>

      <div :class="isCompact ? 'mt-auto pt-1' : 'mt-auto flex flex-col gap-2.5 pt-2'">
        <div :class="isCompact ? 'shrink-0' : 'h-[2.6rem] shrink-0'">
          <p
            v-if="product.discountPrice"
            :class="[
              'price-text line-through text-gray-400',
              isCompact ? 'mb-0 h-[10px] text-[9px] leading-[10px]' : 'mb-0.5 h-[15px] text-[11px] leading-[15px]',
            ]"
          >
            {{ formatPriceCompact(product.price) }}
          </p>
          <p
            :class="[
              'price-text font-bold leading-tight text-gray-900',
              isCompact ? 'text-[11px]' : 'text-base',
            ]"
          >
            {{ formatPriceCompact(product.effectivePrice) }}
            <span :class="isCompact ? 'text-[9px] font-medium text-gray-500' : 'text-[11px] font-medium text-gray-500'">
              تومان
            </span>
          </p>
        </div>

        <div v-if="!isCompact && !isClothingStore" class="flex h-10 shrink-0 items-center justify-end">
          <div v-if="!product.inStock" class="text-[11px] font-medium text-red-500">ناموجود</div>
          <div v-else-if="quantity === 0">
            <button
              class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white transition-all hover:bg-primary-700 active:scale-95"
              :disabled="isAdding"
              @click.stop="handleAdd"
            >
              <AppIcon v-if="!isAdding" name="lucide:plus" size="sm" />
              <AppIcon v-else name="lucide:loader-2" size="sm" class="animate-spin" />
            </button>
          </div>
          <div v-else class="flex items-center rounded-lg bg-primary-50">
            <button class="flex h-8 w-8 items-center justify-center text-primary-600 hover:bg-primary-100" @click.stop="handleDecrease">
              <AppIcon name="lucide:minus" size="sm" />
            </button>
            <span class="w-6 text-center text-sm font-bold text-primary-700">{{ quantity }}</span>
            <button class="flex h-8 w-8 items-center justify-center text-primary-600 hover:bg-primary-100" @click.stop="handleIncrease">
              <AppIcon name="lucide:plus" size="sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-card-sarak-media {
  isolation: isolate;
}

.product-card-sarak-img-primary,
.product-card-sarak-img-hover {
  transition:
    opacity 0.35s ease,
    transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  will-change: opacity, transform;
}

.product-card-sarak-img-hover {
  opacity: 0;
  transform: scale(1.02);
}

.product-card-sarak-colors {
  opacity: 0;
  transform: translateY(6px);
  transition:
    opacity 0.3s ease,
    transform 0.35s ease;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.45), transparent 72%);
}

@media (hover: hover) and (pointer: fine) {
  .product-card--sarak:hover .product-card-sarak-img-primary--hide-on-hover {
    opacity: 0;
    transform: scale(1.02);
  }

  .product-card--sarak:hover .product-card-sarak-img-hover--ready {
    opacity: 1;
    transform: scale(1);
  }

  .product-card--sarak:hover .product-card-sarak-img-primary--zoom {
    transform: scale(1.05);
  }

  .product-card--sarak:hover .product-card-sarak-colors {
    opacity: 1;
    transform: translateY(0);
  }
}

:deep(.product-card-heart-active svg) {
  fill: #ef4444 !important;
  stroke: #ef4444 !important;
  color: #ef4444 !important;
}
</style>
