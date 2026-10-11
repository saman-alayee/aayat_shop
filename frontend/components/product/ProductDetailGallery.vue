<script setup lang="ts">
const props = defineProps<{
  images: string[];
  activeIndex: number;
  productName: string;
}>();

const emit = defineEmits<{
  'update:activeIndex': [index: number];
}>();

const { getProductImage } = useFormat();

const activeSrc = computed(() => {
  const raw = props.images[props.activeIndex];
  return raw ? getProductImage(raw) : getProductImage(null);
});

const hasMany = computed(() => props.images.length > 1);

function step(delta: number) {
  const count = props.images.length;
  if (count < 2) return;
  emit('update:activeIndex', (props.activeIndex + delta + count) % count);
}
</script>

<template>
  <div class="md:sticky md:top-24">
    <div class="relative">
      <div class="relative -mx-4 overflow-hidden bg-white md:mx-0">
        <img
          :src="activeSrc"
          :alt="productName"
          class="block h-auto w-full"
          loading="eager"
        />
        <template v-if="hasMany">
          <button
            type="button"
            class="absolute top-1/2 start-3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-md"
            aria-label="تصویر قبلی"
            @click="step(-1)"
          >
            <AppIcon name="lucide:chevron-right" size="md" />
          </button>
          <button
            type="button"
            class="absolute top-1/2 end-3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-md"
            aria-label="تصویر بعدی"
            @click="step(1)"
          >
            <AppIcon name="lucide:chevron-left" size="md" />
          </button>
        </template>
      </div>

      <div
        v-if="hasMany"
        class="mt-3 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide"
      >
        <button
          v-for="(image, index) in images"
          :key="`${image}-${index}`"
          type="button"
          :class="[
            'h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg border bg-white',
            activeIndex === index ? 'border-[#ef394e]' : 'border-gray-200',
          ]"
          @click="emit('update:activeIndex', index)"
        >
          <img
            :src="getProductImage(image)"
            :alt="`${productName} ${index + 1}`"
            class="h-full w-full object-cover"
            loading="lazy"
          />
        </button>
      </div>
    </div>
  </div>
</template>
