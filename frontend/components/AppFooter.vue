<script setup lang="ts">
import { SITE_NAME, SITE_TAGLINE, CONTACT_PHONE, CONTACT_EMAIL } from '~/constants/site';

const { formatJalaliYear } = useFormat();

const aboutLinks = [
  { to: '/pages/about', label: 'درباره ما' },
  { to: '/contact', label: 'تماس با ما' },
  { to: '/pages/terms', label: 'قوانین و مقررات' },
];

const shopLinks = [
  { to: '/categories', label: 'کالکشن‌ها' },
  { to: '/search?sort=newest', label: 'جدیدترین محصولات' },
  { to: '/search?discounted=1', label: 'پیشنهاد ویژه' },
  { to: '/profile/orders', label: 'پیگیری سفارش' },
];
</script>

<template>
  <footer class="hidden md:block bg-surface-muted border-t border-gray-200 mt-12">
    <div class="max-w-store mx-auto px-4 py-10">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div class="md:col-span-1">
          <AppLogo size="sm" />
          <p class="text-sm text-gray-600 mt-3 leading-relaxed">{{ SITE_TAGLINE }}</p>
        </div>
        <div>
          <h3 class="text-sm font-bold text-gray-900 mb-3">فروشگاه</h3>
          <nav class="flex flex-col gap-2 text-sm text-gray-600">
            <NuxtLink v-for="link in shopLinks" :key="link.to" :to="link.to" class="hover:text-primary-700">
              {{ link.label }}
            </NuxtLink>
          </nav>
        </div>
        <div>
          <h3 class="text-sm font-bold text-gray-900 mb-3">اطلاعات</h3>
          <nav class="flex flex-col gap-2 text-sm text-gray-600">
            <NuxtLink v-for="link in aboutLinks" :key="link.to" :to="link.to" class="hover:text-primary-700">
              {{ link.label }}
            </NuxtLink>
          </nav>
        </div>
        <div>
          <h3 class="text-sm font-bold text-gray-900 mb-3">پشتیبانی</h3>
          <p class="text-sm text-gray-600">هر روز هفته ۸ تا ۲۰</p>
          <a :href="`tel:${CONTACT_PHONE}`" class="text-sm text-primary-700 mt-2 block hover:underline">
            {{ CONTACT_PHONE }}
          </a>
          <a v-if="CONTACT_EMAIL" :href="`mailto:${CONTACT_EMAIL}`" class="text-sm text-gray-600 mt-1 block hover:text-primary-700">
            {{ CONTACT_EMAIL }}
          </a>
        </div>
      </div>
      <p class="text-xs text-gray-400 mt-10 pt-6 border-t border-gray-200">
        © {{ formatJalaliYear() }} {{ SITE_NAME }}
      </p>
    </div>
  </footer>
</template>
