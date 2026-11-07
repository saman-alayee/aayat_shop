<script setup lang="ts">
import type { Order, OrderPaymentUi } from '~/types';
import { getOrderPaymentUi, ORDER_PAYMENT_UI_COLORS, ORDER_PAYMENT_UI_LABELS } from '~/types';

const props = defineProps<{
  order: Pick<Order, 'status' | 'paymentMethod' | 'paymentDetails'>;
}>();

const ui = computed<OrderPaymentUi>(() => getOrderPaymentUi(props.order));
</script>

<template>
  <span :class="['inline-flex items-center px-3 py-1 rounded-full text-xs font-medium', ORDER_PAYMENT_UI_COLORS[ui]]">
    {{ ORDER_PAYMENT_UI_LABELS[ui] }}
  </span>
</template>
