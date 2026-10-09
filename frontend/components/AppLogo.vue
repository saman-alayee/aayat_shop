<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';

withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg';
    link?: boolean;
  }>(),
  {
    size: 'md',
    link: true,
  }
);

const textClass = {
  sm: 'text-sm tracking-[0.2em]',
  md: 'text-base md:text-lg tracking-[0.22em]',
  lg: 'text-base md:text-lg lg:text-xl tracking-[0.28em]',
};
</script>

<template>
  <NuxtLink
    v-if="link"
    to="/"
    class="inline-flex items-center shrink-0 relative z-10 cursor-pointer text-gray-900 hover:text-primary-800 transition-colors"
    :aria-label="`صفحه اصلی ${SITE_NAME}`"
  >
    <span :class="[textClass[size], 'font-bold']">{{ SITE_NAME }}</span>
  </NuxtLink>
  <div v-else class="inline-flex items-center shrink-0 text-gray-900">
    <span :class="[textClass[size], 'font-bold']">{{ SITE_NAME }}</span>
  </div>
</template>
