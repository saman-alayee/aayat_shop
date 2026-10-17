<script setup lang="ts">
/** دسته‌های صفحه اصلی — کارت آیکون، مثل اودما. */
const tiles = [
  { slug: 't-shirt', name: 'تیشرت', image: '/wp-home/categories/tshirt.png' },
  { slug: 'paperbacks-and-shirts', name: 'شومیز', image: '/wp-home/categories/blouse.png' },
  { slug: 'pants', name: 'شلوار', image: '/wp-home/categories/pants.png' },
  { slug: 'overalls', name: 'اورال', image: '/wp-home/categories/overalls.png' },
  { slug: 'knitted-blouse', name: 'بافت', image: '/wp-home/categories/knitted-blouse.png' },
  { slug: 'beach-shirt', name: 'پیراهن', image: '/wp-home/categories/dress.png' },
  { slug: 'coat', name: 'کت', image: '/wp-home/categories/coat.png' },
] as const;
</script>

<template>
  <section class="grid grid-cols-2 gap-3 px-4 py-5 md:grid-cols-3 md:gap-4 md:px-6 md:py-8">
    <NuxtLink
      v-for="tile in tiles"
      :key="tile.slug"
      :to="`/categories/${tile.slug}`"
      :aria-label="tile.name"
      class="relative flex h-28 items-center justify-center overflow-hidden rounded-[1.6rem] bg-[#f7f1e8] ring-1 ring-[#e4d5c4] transition-colors hover:bg-[#f3ebdf] md:h-36"
    >
      <img
        :src="tile.image"
        :alt="tile.name"
        class="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </NuxtLink>
  </section>
</template>
