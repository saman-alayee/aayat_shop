<script setup lang="ts">
/** کارت‌های دسته از صفحه اصلی aaytay.ir — متن داخل خود تصویر است. */
const tiles = [
  { slug: 'pants', image: '/wp-home/cat-pants.webp', name: 'شلوار' },
  { slug: 'overalls', image: '/wp-home/cat-overalls.webp', name: 'اورال' },
  { slug: 'paperbacks-and-shirts', image: '/wp-home/cat-blouse.webp', name: 'شومیز' },
  { slug: 'coat', image: '/wp-home/cat-coat.webp', name: 'کت' },
  { slug: 'beach-shirt', image: '/wp-home/cat-beach.webp', name: 'پیراهن ساحلی' },
  { slug: 't-shirt', image: '/wp-home/cat-tshirt.webp', name: 'تیشرت' },
];
</script>

<template>
  <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 px-3 md:px-6 py-4 md:py-6">
    <NuxtLink
      v-for="tile in tiles"
      :key="tile.slug"
      :to="`/categories/${tile.slug}`"
      class="block overflow-hidden rounded-2xl bg-neutral-100"
    >
      <img
        :src="tile.image"
        :alt="tile.name"
        class="h-auto w-full object-cover"
        width="640"
        height="800"
        loading="lazy"
        decoding="async"
      />
    </NuxtLink>
  </section>
</template>
