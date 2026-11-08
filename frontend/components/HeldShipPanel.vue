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
const { formatPrice, toPersianDigits } = useFormat();
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
            {{ variant === 'success' ? 'الان می‌توانید ارسال را بزنید' : 'پرداخت شده — منتظر ارسال' }}
          </h2>
          <p class="mt-1 text-sm leading-6 text-amber-900/80">
            لباس‌ها خریداری شده‌اند ولی هنوز برای پست ثبت نشده‌اند.
            وقتی آماده تحویل بودید، دکمهٔ زیر را بزنید.
          </p>
          <p
            v-if="ordersStore.shipRequestDaysLeft != null"
            class="mt-2 text-sm font-medium text-amber-950"
          >
            <template v-if="ordersStore.shipRequestDaysLeft > 0">
              {{ toPersianDigits(ordersStore.shipRequestDaysLeft) }} روز تا پایان مهلت درخواست ارسال
            </template>
            <template v-else>
              مهلت تمام شده؛ سفارش به‌زودی برای ارسال ثبت می‌شود
            </template>
          </p>
          <p
            v-else-if="ordersStore.shipRequestDeadlineDays"
            class="mt-2 text-xs text-amber-800/80"
          >
            مهلت درخواست ارسال: {{ toPersianDigits(ordersStore.shipRequestDeadlineDays) }} روز از خرید
          </p>
          <p v-if="ordersStore.heldCount > 1" class="mt-1 text-xs text-amber-800/70">
            {{ toPersianDigits(ordersStore.heldCount) }} سفارش منتظر درخواست ارسال
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
          :key="item.id"
          class="flex items-center justify-between gap-3 py-2.5 text-sm"
        >
          <span class="min-w-0">
            <span class="block truncate font-medium text-gray-800">{{ item.name }}</span>
            <span class="text-xs text-gray-400">
              {{ toPersianDigits(item.quantity) }} عدد · {{ item.orderNumber }}
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
