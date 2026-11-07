<script setup lang="ts">
import { useOrdersStore } from '~/stores/orders';

const route = useRoute();
const cartStore = useCartStore();
const ordersStore = useOrdersStore();
const { toPersianDigits } = useFormat();

const navItems = [
  { to: '/', label: 'خانه', icon: 'lucide:home' },
  { to: '/categories', label: 'دسته‌بندی', icon: 'lucide:shirt' },
  { to: '/cart', label: 'سبد خرید', icon: 'lucide:shopping-bag', badge: 'cart' as const },
  { to: '/profile', label: 'پروفایل', icon: 'lucide:user', badge: 'held' as const },
];

const cartBadge = computed(() => {
  if (cartStore.totalItems > 0) return cartStore.totalItems;
  if (ordersStore.heldCount > 0) return ordersStore.heldCount;
  return 0;
});

function isActive(path: string) {
  if (path === '/') return route.path === '/';
  if (path === '/profile') return route.path === '/profile' || route.path.startsWith('/profile/');
  return route.path.startsWith(path);
}
</script>

<template>
  <nav class="fixed bottom-0 inset-x-0 z-50 bg-surface-muted border-t border-primary-200/80 md:hidden pb-[env(safe-area-inset-bottom)]">
    <div class="flex items-center justify-around py-2 px-1">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.badge === 'held' && ordersStore.hasHeld ? '/profile/orders' : item.to"
        class="flex flex-col items-center gap-0.5 px-1.5 py-1 min-w-0 flex-1 max-w-[72px]"
      >
        <div class="relative">
          <AppIcon
            :name="item.icon"
            size="md"
            :class="isActive(item.to) ? 'text-primary-600' : 'text-gray-400'"
          />
          <span
            v-if="item.badge === 'cart' && cartBadge > 0"
            class="absolute -top-1.5 -start-2 min-w-[16px] h-4 px-1 text-[10px] font-bold leading-none text-white rounded-full flex items-center justify-center ring-2 ring-white"
            :class="cartStore.totalItems > 0 ? 'bg-primary-600' : 'bg-amber-500'"
          >
            {{ toPersianDigits(cartBadge) }}
          </span>
          <span
            v-else-if="item.badge === 'held' && ordersStore.heldCount > 0"
            class="absolute -top-1.5 -start-2 min-w-[16px] h-4 px-1 text-[10px] font-bold leading-none text-white bg-amber-500 rounded-full flex items-center justify-center ring-2 ring-white"
          >
            {{ toPersianDigits(ordersStore.heldCount) }}
          </span>
        </div>
        <span :class="['text-[9px] font-medium leading-tight text-center', isActive(item.to) ? 'text-primary-600' : 'text-gray-400']">
          {{ item.label }}
        </span>
      </NuxtLink>
    </div>
  </nav>
</template>
