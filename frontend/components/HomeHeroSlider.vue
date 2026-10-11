<script setup lang="ts">
import type { Slider } from '~/types';

const props = withDefaults(
  defineProps<{
    sliders: Slider[];
    autoplayMs?: number;
    layout?: 'fullscreen' | 'banner';
  }>(),
  { autoplayMs: 6000, layout: 'fullscreen' }
);

const { resolveMediaUrl } = useFormat();

const activeIndex = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

function goTo(index: number) {
  if (!props.sliders.length) return;
  activeIndex.value = (index + props.sliders.length) % props.sliders.length;
}

function startAutoplay() {
  stopAutoplay();
  if (props.sliders.length <= 1) return;
  timer = setInterval(() => goTo(activeIndex.value + 1), props.autoplayMs);
}

function stopAutoplay() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

watch(() => props.sliders.length, () => {
  activeIndex.value = 0;
  startAutoplay();
});

onMounted(startAutoplay);
onUnmounted(stopAutoplay);
</script>

<template>
  <section
    v-if="sliders.length"
    :class="[
      'relative w-full overflow-hidden bg-neutral-100',
      layout === 'banner'
        ? 'h-[100dvh] max-h-none md:h-auto md:max-h-[520px] md:aspect-[2560/936]'
        : 'h-[100dvh] min-h-[520px] max-h-[1080px] bg-neutral-900',
    ]"
    @mouseenter="stopAutoplay"
    @mouseleave="startAutoplay"
  >
    <div dir="ltr" class="absolute inset-0">
      <div
        class="flex h-full w-full transition-transform duration-700 ease-out"
        :style="{ transform: `translateX(-${activeIndex * 100}%)` }"
      >
        <component
          :is="slider.linkUrl ? 'NuxtLink' : 'div'"
          v-for="(slider, index) in sliders"
          :key="slider.id"
          :to="slider.linkUrl || undefined"
          class="relative block h-full w-full shrink-0 grow-0 basis-full"
        >
          <img
            :src="resolveMediaUrl(slider.image)"
            :alt="slider.title || 'بنر'"
            class="h-full w-full object-cover object-center"
            :loading="index === 0 ? 'eager' : 'lazy'"
            fetchpriority="high"
            @error="(e) => { const t = e.target as HTMLImageElement; if (t && !t.src.endsWith('placeholder-product.svg')) t.src = '/images/placeholder-product.svg'; }"
          />
          <div
            v-if="layout !== 'banner'"
            class="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-black/20 pointer-events-none"
          />
        </component>
      </div>
    </div>

    <div
      v-if="sliders[activeIndex]?.title"
      class="pointer-events-none absolute inset-x-0 bottom-[18%] md:bottom-[22%] px-6 md:px-16 lg:px-24 text-white"
    >
      <p class="text-[11px] md:text-xs tracking-[0.35em] uppercase opacity-90 mb-2 md:mb-3">
        New Collection
      </p>
      <p class="text-2xl md:text-4xl lg:text-[2.75rem] font-light tracking-wide leading-tight">
        {{ sliders[activeIndex]?.title }}
      </p>
    </div>

    <div v-if="sliders.length > 1" class="absolute inset-x-0 bottom-[5.5rem] z-10 flex justify-center gap-1.5 md:bottom-6">
      <button
        v-for="(_, index) in sliders"
        :key="index"
        type="button"
        :class="[
          'h-0.5 rounded-full transition-all',
          index === activeIndex ? 'w-8 bg-white' : 'w-3 bg-white/45',
        ]"
        :aria-label="`اسلاید ${index + 1}`"
        @click="goTo(index)"
      />
    </div>
  </section>
</template>
