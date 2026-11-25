<script setup lang="ts">
import { useOrdersStore } from '~/stores/orders';

const props = withDefaults(
  defineProps<{
    /** compact = نوار کوتاه؛ full = کارت با لیست اقلام */
    variant?: 'full' | 'compact' | 'success';
    showItems?: boolean;
  }>(),
  {
    variant: 'full',
    showItems: true,
  }
);

const emit = defineEmits<{ shipped: [] }>();

const ordersStore = useOrdersStore();
const { formatPrice, formatShortDate, toPersianDigits, getProductImage } = useFormat();
const toast = useToast();

async function onShip() {
  const ok = await ordersStore.requestShipment();
  if (ok) {
    toast.success(ordersStore.shipMessage || 'درخواست ارسال ثبت شد');
    emit('shipped');
  } else if (ordersStore.shipError) {
    toast.error(ordersStore.shipError);
  }
}
</script>

<template>
  <section
    v-if="ordersStore.hasHeld || ordersStore.shipMessage"
    :class="[
      'rounded-2xl border text-start',
      variant === 'success'
        ? 'border-amber-300 bg-amber-50 p-5 shadow-lg'
        : variant === 'compact'
          ? 'border-amber-200 bg-amber-50 px-3 py-3'
          : 'border-amber-200 bg-white p-4 shadow-card sm:p-5',
    ]"
  >
    <p
      v-if="ordersStore.shipMessage && !ordersStore.hasHeld"
      class="text-sm leading-6 text-green-800"
    >
      {{ ordersStore.shipMessage }}
    </p>

    <template v-else>
      <div class="flex items-start gap-3">
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"
        >
          <AppIcon name="lucide:truck" size="md" />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="text-base font-bold text-amber-950">
            {{ variant === 'success' ? 'الان می‌توانید ارسال را بزنید' : 'سبد ارسال' }}
          </h2>
          <p class="mt-1 text-sm leading-6 text-amber-900/80">
            لباس‌های پرداخت‌شده اینجا جمع می‌شوند (قبلی و جدید با هم).
            وقتی آماده بودید یک‌بار «درخواست ارسال» بزنید تا همه با هم بروند.
          </p>
          <p
            v-if="ordersStore.shipRequestDeadlineAt"
            class="mt-2 text-sm font-bold text-amber-950"
          >
            تاریخ درخواست ارسال (روی کل سبد):
            {{ formatShortDate(ordersStore.shipRequestDeadlineAt) }}
          </p>
          <p
            v-else-if="ordersStore.shipRequestDaysLeft != null"
            class="mt-2 text-sm font-medium text-amber-950"
          >
            <template v-if="ordersStore.shipRequestDaysLeft > 0">
              {{ toPersianDigits(ordersStore.shipRequestDaysLeft) }} روز تا پایان مهلت درخواست ارسال
            </template>
            <template v-else>
              مهلت تمام شده؛ سفارش به‌زودی برای ارسال ثبت می‌شود
            </template>
          </p>
          <p v-if="ordersStore.heldItemCount > 0" class="mt-1 text-xs text-amber-800/70">
            {{ toPersianDigits(ordersStore.heldItemCount) }} لباس در سبد ارسال
            <template v-if="ordersStore.heldCount > 1">
              · از {{ toPersianDigits(ordersStore.heldCount) }} خرید
            </template>
          </p>
        </div>
      </div>

      <p v-if="ordersStore.shipError" class="mt-3 text-sm text-red-600">{{ ordersStore.shipError }}</p>

      <button
        type="button"
        class="btn-primary mt-4 flex h-12 w-full items-center justify-center gap-2 text-base font-bold"
        :disabled="ordersStore.requestingShip"
        @click="onShip"
      >
        <AppIcon name="lucide:send" size="sm" />
        {{ ordersStore.requestingShip ? 'در حال ثبت...' : 'درخواست ارسال' }}
      </button>

      <ul
        v-if="showItems && props.variant !== 'compact' && ordersStore.heldItems.length"
        class="mt-4 divide-y divide-amber-100 border-t border-amber-100 pt-2"
      >
        <li
          v-for="item in ordersStore.heldItems"
          :key="`${item.orderId}-${item.id}`"
          class="flex items-center gap-3 py-2.5 text-sm"
        >
          <img
            :src="getProductImage(item.product?.image ?? null)"
            :alt="item.name"
            class="h-12 w-12 shrink-0 rounded-lg border border-amber-100 bg-amber-50 object-cover"
            loading="lazy"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium text-gray-800">{{ item.name }}</span>
            <span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400">
              <span>{{ toPersianDigits(item.quantity) }} عدد</span>
              <span v-if="item.purchasedAt" class="font-medium text-amber-900/80">
                تاریخ خرید: {{ formatShortDate(item.purchasedAt) }}
              </span>
            </span>
          </span>
          <span class="shrink-0 font-bold text-gray-800">
            {{ formatPrice(item.price * item.quantity) }}
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>
