<script setup lang="ts">
import { useOrdersStore } from '~/stores/orders';

const ordersStore = useOrdersStore();
const { formatPrice, formatShortDate, toPersianDigits, getProductImage } = useFormat();
</script>

<template>
  <section
    v-if="ordersStore.hasShipRequests"
    class="rounded-2xl border border-emerald-200 bg-white p-4 text-start shadow-card sm:p-5"
  >
    <div class="flex items-start gap-3">
      <div
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800"
      >
        <AppIcon name="lucide:package-check" size="md" />
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="text-base font-bold text-emerald-950">درخواست ارسال شما</h2>
        <p
          v-if="ordersStore.activeShipRequestDate"
          class="mt-1 text-sm font-bold text-emerald-900"
        >
          تاریخ درخواست ارسال (روی کل):
          {{ formatShortDate(ordersStore.activeShipRequestDate) }}
        </p>
        <p class="mt-1 text-xs text-emerald-800/70">
          {{ toPersianDigits(ordersStore.shipRequestItemCount) }} لباس در حال آماده‌سازی
        </p>
      </div>
    </div>

    <ul
      v-if="ordersStore.shipRequestItems.length"
      class="mt-4 divide-y divide-emerald-100 border-t border-emerald-100 pt-2"
    >
      <li
        v-for="item in ordersStore.shipRequestItems"
        :key="`${item.orderId}-${item.id}`"
        class="flex items-center gap-3 py-2.5 text-sm"
      >
        <img
          :src="getProductImage(item.product?.image ?? null)"
          :alt="item.name"
          class="h-12 w-12 shrink-0 rounded-lg border border-emerald-100 bg-emerald-50 object-cover"
          loading="lazy"
        />
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium text-gray-800">{{ item.name }}</span>
          <span class="mt-0.5 text-xs font-medium text-emerald-900/80">
            <template v-if="item.purchasedAt">
              تاریخ خرید: {{ formatShortDate(item.purchasedAt) }}
            </template>
          </span>
        </span>
        <span class="shrink-0 font-bold text-gray-800">
          {{ formatPrice(item.price * item.quantity) }}
        </span>
      </li>
    </ul>
  </section>
</template>
