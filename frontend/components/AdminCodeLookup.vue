<script setup lang="ts">
import type { OrderStatus } from '~/types';
import { ORDER_STATUS_LABELS } from '~/types';

type LookupProduct = {
  id: string;
  name: string;
  barcode: string | null;
  stock: number;
  image: string | null;
  isActive: boolean;
  price: number;
};

type LookupOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  totalPrice: number;
  createdAt: string;
  codes: string[];
  itemNames: string[];
};

const props = withDefaults(
  defineProps<{
    /** Prefill from URL or parent */
    initialQuery?: string;
    autofocus?: boolean;
  }>(),
  { initialQuery: '', autofocus: false }
);

const emit = defineEmits<{ openOrder: [id: string] }>();

const api = useApi();
const { formatPrice, resolveMediaUrl, toPersianDigits } = useFormat();

const query = ref(props.initialQuery || '');
const loading = ref(false);
const searched = ref(false);
const products = ref<LookupProduct[]>([]);
const orders = ref<LookupOrder[]>([]);
const error = ref('');

watch(
  () => props.initialQuery,
  (v) => {
    if (v && v !== query.value) {
      query.value = v;
      void runSearch();
    }
  }
);

async function runSearch() {
  const q = query.value.trim();
  error.value = '';
  if (!q) {
    products.value = [];
    orders.value = [];
    searched.value = false;
    return;
  }
  loading.value = true;
  searched.value = true;
  try {
    const { data } = await api.get<{ products: LookupProduct[]; orders: LookupOrder[] }>(
      `/admin/lookup?q=${encodeURIComponent(q)}`
    );
    products.value = data.products;
    orders.value = data.orders;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'جستجو انجام نشد';
    products.value = [];
    orders.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (props.initialQuery?.trim()) void runSearch();
});
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div class="min-w-0 flex-1">
        <label class="mb-1 block text-sm font-medium text-slate-700">جستجوی کد لباس / سفارش / مشتری</label>
        <input
          v-model="query"
          type="search"
          class="input-field"
          :autofocus="autofocus"
          placeholder="مثلاً ۵۶۰ یا HM-2026… یا نام/موبایل"
          dir="auto"
          @keyup.enter="runSearch"
        />
        <p class="mt-1 text-xs leading-5 text-slate-400">
          کد لباس را بزنید تا ببینید چیست و مال کدام مشتری/سفارش است.
        </p>
      </div>
      <button type="button" class="btn-primary shrink-0 px-5" :disabled="loading" @click="runSearch">
        {{ loading ? '...' : 'جستجو' }}
      </button>
    </div>

    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>

    <div v-if="searched && !loading" class="mt-4 space-y-4">
      <div>
        <h3 class="mb-2 text-sm font-bold text-slate-700">
          محصول
          <span class="font-normal text-slate-400">({{ toPersianDigits(products.length) }})</span>
        </h3>
        <div v-if="products.length" class="space-y-2">
          <NuxtLink
            v-for="p in products"
            :key="p.id"
            :to="`/admin/products?search=${encodeURIComponent(p.barcode || p.name)}`"
            class="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 hover:border-primary-200"
          >
            <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
              <img
                v-if="p.image"
                :src="resolveMediaUrl(p.image)"
                :alt="p.name"
                class="h-full w-full object-cover"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-slate-800">{{ p.name }}</p>
              <p class="mt-0.5 text-xs text-slate-500">
                کد:
                <span class="font-bold tabular-nums text-primary-700" dir="ltr">{{ p.barcode || '—' }}</span>
                · موجودی {{ toPersianDigits(p.stock) }}
                · {{ formatPrice(p.price) }}
              </p>
            </div>
            <span :class="p.isActive ? 'admin-badge-success' : 'admin-badge-danger'">
              {{ p.isActive ? 'فعال' : 'غیرفعال' }}
            </span>
          </NuxtLink>
        </div>
        <p v-else class="text-sm text-slate-400">محصولی با این کد/نام پیدا نشد.</p>
      </div>

      <div>
        <h3 class="mb-2 text-sm font-bold text-slate-700">
          سفارش / ارسال
          <span class="font-normal text-slate-400">({{ toPersianDigits(orders.length) }})</span>
        </h3>
        <div v-if="orders.length" class="space-y-2">
          <button
            v-for="o in orders"
            :key="o.id"
            type="button"
            class="flex w-full flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-start hover:border-primary-200"
            @click="emit('openOrder', o.id)"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-bold tabular-nums text-slate-800" dir="ltr">{{ o.orderNumber }}</span>
              <OrderStatusBadge :status="o.status" />
            </div>
            <p class="text-sm text-slate-700">
              <span class="font-medium">{{ o.customerName }}</span>
              <span class="text-slate-400" dir="ltr"> · {{ o.customerPhone }}</span>
            </p>
            <p v-if="o.codes.length" class="text-xs text-primary-700">
              کد لباس:
              <span dir="ltr" class="font-semibold tabular-nums">{{ o.codes.join(' · ') }}</span>
            </p>
            <p class="truncate text-xs text-slate-400">{{ o.itemNames.join('، ') }}</p>
            <p class="text-xs text-slate-500">
              {{ ORDER_STATUS_LABELS[o.status] }} · {{ formatPrice(o.totalPrice) }}
            </p>
          </button>
        </div>
        <p v-else class="text-sm text-slate-400">سفارشی با این کد/مشتری پیدا نشد.</p>
      </div>

      <div class="flex flex-wrap gap-2 pt-1">
        <NuxtLink
          :to="`/admin/orders?search=${encodeURIComponent(query.trim())}`"
          class="text-xs font-medium text-primary-600 hover:underline"
        >
          همه نتایج در سفارش‌ها
        </NuxtLink>
        <NuxtLink
          :to="`/admin/products?search=${encodeURIComponent(query.trim())}`"
          class="text-xs font-medium text-primary-600 hover:underline"
        >
          همه نتایج در محصولات
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
