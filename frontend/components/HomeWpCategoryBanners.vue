<script setup lang="ts">
import type { Category } from '~/types';

const api = useApi();
const { getCategoryImage } = useFormat();

const tiles = ref<Category[]>([]);
const loaded = ref(false);

onMounted(async () => {
  try {
    const { data } = await api.get<Category[]>('/categories?home=1');
    tiles.value = Array.isArray(data) ? data : [];
  } catch {
    tiles.value = [];
  } finally {
    loaded.value = true;
  }
});
</script>

<template>
  <section
    v-if="!loaded || tiles.length"
    class="grid grid-cols-2 gap-3 px-4 py-5 md:grid-cols-4 md:gap-4 md:px-6 md:py-8"
    :aria-busy="!loaded"
  >
    <NuxtLink
      v-for="tile in tiles"
      :key="tile.id"
      :to="`/categories/${tile.slug}`"
      :aria-label="tile.name"
      class="relative flex h-28 items-center justify-center overflow-hidden rounded-[1.6rem] bg-[#f7f1e8] ring-1 ring-[#e4d5c4] transition-colors hover:bg-[#f3ebdf] md:h-36"
    >
      <img
        :src="getCategoryImage(tile.image)"
        :alt="tile.name"
        class="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </NuxtLink>
  </section>
</template>
