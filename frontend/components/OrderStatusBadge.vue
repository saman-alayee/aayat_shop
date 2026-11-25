<script setup lang="ts">
import type { OrderStatus } from '~/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '~/types';

defineProps<{
  status: OrderStatus;
}>();
</script>

<template>
  <span
    :class="[
      'inline-flex shrink-0 items-center whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium',
      ORDER_STATUS_COLORS[status],
    ]"
  >
    {{ ORDER_STATUS_LABELS[status] }}
  </span>
</template>
