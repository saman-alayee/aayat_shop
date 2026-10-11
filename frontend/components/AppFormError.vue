<script setup lang="ts">
defineProps<{
  message?: string;
}>();
</script>

<template>
  <p v-if="message" class="mt-1 text-[11px] tracking-wide text-red-700" role="alert">
    {{ message }}
  </p>
</template>
