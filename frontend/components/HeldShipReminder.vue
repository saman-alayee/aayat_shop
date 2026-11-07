<script setup lang="ts">
import { useOrdersStore } from '~/stores/orders';

const route = useRoute();
const authStore = useAuthStore();
const ordersStore = useOrdersStore();
const toast = useToast();
const { toPersianDigits } = useFormat();

/** صفحاتی که خودشان CTA کامل دارند — نوار شناور تکراری نشود */
const hideOn = computed(() => {
  const path = route.path;
  return (
    path === '/cart' ||
    path.startsWith('/orders/success') ||
    path.startsWith('/checkout') ||
    path.startsWith('/admin')
  );
});

const show = computed(
  () => authStore.isLoggedIn && ordersStore.hasHeld && !hideOn.value
);

let fetched = false;
watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn && !fetched) {
      fetched = true;
      void ordersStore.fetchHeld();
    }
    if (!loggedIn) {
      fetched = false;
      ordersStore.heldOrders = [];
    }
  },
  { immediate: true }
);

onMounted(() => {
  authStore.init();
  if (authStore.isLoggedIn) void ordersStore.fetchHeld();
});

async function onShip() {
  const ok = await ordersStore.requestShipment();
  if (ok) toast.success(ordersStore.shipMessage || 'درخواست ارسال ثبت شد');
  else if (ordersStore.shipError) toast.error(ordersStore.shipError);
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-x-0 bottom-16 z-40 px-3 pb-[env(safe-area-inset-bottom)] md:bottom-4 md:px-4"
  >
    <div
      class="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 shadow-lg md:max-w-xl"
    >
      <div class="min-w-0 flex-1">
        <p class="text-sm font-bold text-amber-950">درخواست ارسال را بزنید</p>
        <p class="text-[11px] leading-4 text-amber-900/75">
          {{ toPersianDigits(ordersStore.heldCount) }} سفارش پرداخت‌شده منتظر ارسال است
        </p>
      </div>
      <button
        type="button"
        class="btn-primary shrink-0 h-10 px-4 text-sm font-bold"
        :disabled="ordersStore.requestingShip"
        @click="onShip"
      >
        {{ ordersStore.requestingShip ? '...' : 'ارسال' }}
      </button>
    </div>
  </div>
</template>
