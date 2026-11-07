<script setup lang="ts">
import type { Pagination } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const { formatPrice, formatNumber, formatShortDate, formatMonthYear, formatDate } = useFormat();

const TX_PAGE_SIZE = 20;

type SalesItem = {
  name: string;
  code: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type PaymentBucket = 'paid' | 'pending' | 'failed' | 'cod';

type SalesTransaction = {
  id: string;
  orderNumber: string;
  createdAt: string;
  tehranDate?: string;
  customerName: string;
  customerPhone: string;
  totalPrice: number;
  clothingCodes: string;
  itemsSummary: string;
  items: SalesItem[];
  paymentBucket?: PaymentBucket;
  countedInRevenue?: boolean;
  zibalRef?: string | null;
  status?: string;
};

const PAYMENT_BUCKET_LABELS: Record<PaymentBucket, string> = {
  paid: 'پرداخت شده',
  pending: 'پرداخت نشده',
  failed: 'ناموفق',
  cod: 'پرداخت در محل',
};

const PAYMENT_BUCKET_CLASS: Record<PaymentBucket, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-orange-100 text-orange-800',
  failed: 'bg-red-100 text-red-700',
  cod: 'bg-slate-100 text-slate-700',
};

const days = ref(30);
const dateFrom = ref<string | null>(null);
const dateTo = ref<string | null>(null);
const productSearch = ref('');
const loading = ref(true);
const txLoading = ref(false);
const expandedId = ref<string | null>(null);
const txTab = ref<'paid' | 'pending'>('paid');
const txPage = ref(1);
const transactions = ref<SalesTransaction[]>([]);
const txPagination = ref<Pagination | null>(null);
const txPageSum = ref(0);

const overview = ref<{
  totalRevenue: number;
  orderCount: number;
  pendingTotal?: number;
  pendingCount?: number;
  failedTotal?: number;
  failedCount?: number;
  avgOrder: number;
  avgPerCustomer: number;
  uniqueCustomers: number;
  timezone?: string;
  range?: { from: string; to: string };
  daily: { date: string; revenue: number; orders: number }[];
  workingDays: { date: string; revenue: number; orders: number }[];
  topProducts: { name: string; totalQuantity: number; product?: { barcode?: string | null } | null }[];
  today?: { date: string; totalRevenue: number; orderCount: number; pendingTotal?: number };
  monthly: {
    monthly: { month: string; revenue: number; orders: number }[];
    changePercent: number | null;
  };
} | null>(null);

function filterParams() {
  const params = new URLSearchParams();
  if (dateFrom.value || dateTo.value) {
    if (dateFrom.value) params.set('dateFrom', dateFrom.value);
    if (dateTo.value) params.set('dateTo', dateTo.value);
  } else {
    params.set('days', String(days.value));
  }
  if (productSearch.value.trim()) params.set('productSearch', productSearch.value.trim());
  return params;
}

async function loadTransactions(page = txPage.value) {
  txLoading.value = true;
  expandedId.value = null;
  try {
    const params = filterParams();
    params.set('page', String(page));
    params.set('limit', String(TX_PAGE_SIZE));
    params.set('paymentBucket', txTab.value);
    const { data } = await api.get<{
      items: SalesTransaction[];
      pagination: Pagination;
      pageSum?: number;
    }>(`/admin/sales/transactions?${params}`);
    transactions.value = data.items || [];
    txPagination.value = data.pagination || null;
    txPage.value = data.pagination?.page || page;
    txPageSum.value = Number(data.pageSum || 0);
  } catch {
    transactions.value = [];
    txPagination.value = null;
  } finally {
    txLoading.value = false;
  }
}

async function load() {
  loading.value = true;
  txPage.value = 1;
  try {
    const params = filterParams();
    const { data } = await api.get<typeof overview.value>(`/admin/sales/overview?${params}`);
    overview.value = data;
    await loadTransactions(1);
  } finally {
    loading.value = false;
  }
}

function applyPreset() {
  dateFrom.value = null;
  dateTo.value = null;
  void load();
}

function setTxTab(tab: 'paid' | 'pending') {
  if (txTab.value === tab) return;
  txTab.value = tab;
  txPage.value = 1;
  void loadTransactions(1);
}

function goToTxPage(next: number) {
  txPage.value = next;
  void loadTransactions(next);
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

onMounted(load);
watch(days, applyPreset);

const maxDaily = computed(() => {
  const rows = overview.value?.workingDays?.length
    ? overview.value.workingDays
    : overview.value?.daily || [];
  return Math.max(...rows.map((d) => d.revenue), 1);
});
const maxMonthly = computed(() =>
  Math.max(...(overview.value?.monthly?.monthly.map((m) => m.revenue) || [1]), 1)
);

const dailyWithSales = computed(() =>
  (overview.value?.workingDays || overview.value?.daily || [])
    .filter((d) => d.orders > 0 || d.revenue > 0)
    .slice()
    .reverse()
);

useHead({ title: 'گزارش فروش - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-xl font-bold">گزارش فروش</h1>
        <p class="text-sm leading-6 text-gray-500 mt-1 max-w-2xl">
          فقط سفارش‌های واقعاً پرداخت‌شده در درآمد می‌آیند. تاریخ‌ها با ساعت ایران محاسبه می‌شوند.
        </p>
      </div>
    </div>

    <div class="card p-4 mb-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <select v-model.number="days" class="input-field">
        <option :value="7">۷ روز اخیر</option>
        <option :value="30">۳۰ روز اخیر</option>
        <option :value="90">۹۰ روز اخیر</option>
      </select>
      <AppDatePicker v-model="dateFrom" placeholder="از تاریخ" />
      <AppDatePicker v-model="dateTo" placeholder="تا تاریخ" :min="dateFrom" />
      <input
        v-model="productSearch"
        type="search"
        class="input-field"
        placeholder="نام یا کد لباس"
        @keyup.enter="load"
      />
      <button class="btn-primary text-sm" @click="load">اعمال فیلتر</button>
    </div>

    <LoadingSpinner :show="loading" />

    <template v-if="!loading && overview">
      <p v-if="overview.range" class="text-xs text-gray-500 mb-3">
        بازه:
        <span class="font-medium text-slate-700">{{ formatShortDate(overview.range.from) }}</span>
        تا
        <span class="font-medium text-slate-700">{{ formatShortDate(overview.range.to) }}</span>
        <span v-if="overview.timezone" class="text-gray-400"> · {{ overview.timezone }}</span>
      </p>

      <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <div class="card p-4">
          <p class="text-xs text-gray-500">درآمد قطعی</p>
          <p class="text-lg font-bold mt-1 text-emerald-700">{{ formatPrice(overview.totalRevenue) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-gray-500">امروز (قطعی)</p>
          <p class="text-lg font-bold mt-1">{{ formatPrice(overview.today?.totalRevenue || 0) }}</p>
          <p class="text-[11px] text-gray-400 mt-1">
            {{ formatNumber(overview.today?.orderCount || 0) }} سفارش
          </p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-gray-500">پرداخت‌نشده</p>
          <p class="text-lg font-bold mt-1 text-orange-600">{{ formatPrice(overview.pendingTotal || 0) }}</p>
          <p class="text-[11px] text-gray-400 mt-1">{{ formatNumber(overview.pendingCount || 0) }} سفارش · داخل درآمد نیست</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-gray-500">فروش قطعی</p>
          <p class="text-lg font-bold mt-1">{{ formatNumber(overview.orderCount) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-gray-500">میانگین سفارش</p>
          <p class="text-lg font-bold mt-1">{{ formatPrice(overview.avgOrder) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-gray-500">میانگین هر مشتری</p>
          <p class="text-lg font-bold mt-1">{{ formatPrice(overview.avgPerCustomer || 0) }}</p>
        </div>
      </div>

      <div class="data-table-wrap p-0 mb-6">
        <div class="px-4 pt-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-semibold text-slate-800">تراکنش‌ها</h2>
            <div class="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
              <button
                type="button"
                class="px-3 py-1 rounded-md transition"
                :class="txTab === 'paid' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'"
                @click="setTxTab('paid')"
              >
                فروش قطعی ({{ formatNumber(overview.orderCount) }})
              </button>
              <button
                type="button"
                class="px-3 py-1 rounded-md transition"
                :class="txTab === 'pending' ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-50'"
                @click="setTxTab('pending')"
              >
                پرداخت‌نشده ({{ formatNumber(overview.pendingCount || 0) }})
              </button>
            </div>
          </div>
          <div class="text-xs text-gray-500">
            جمع این صفحه:
            <span
              class="font-semibold"
              :class="txTab === 'paid' ? 'text-emerald-700' : 'text-orange-600'"
            >
              {{ formatPrice(txPageSum) }}
            </span>
          </div>
        </div>

        <div v-if="txLoading" class="px-4 py-8 text-center text-sm text-gray-500">در حال بارگذاری...</div>
        <div v-else class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>تاریخ و ساعت</th>
                <th>خریدار</th>
                <th>کد لباس‌ها</th>
                <th>پرداخت</th>
                <th class="data-num">مبلغ</th>
                <th>جزئیات</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="transactions.length">
                <template v-for="tx in transactions" :key="tx.id">
                  <tr :class="txTab === 'pending' ? 'bg-orange-50/50' : ''">
                    <td class="whitespace-nowrap text-slate-600">
                      <div class="font-medium text-slate-800">{{ formatDate(tx.createdAt) }}</div>
                      <div class="text-[11px] text-slate-400 mt-0.5">{{ tx.orderNumber }}</div>
                    </td>
                    <td>
                      <div class="font-medium text-slate-800">{{ tx.customerName || '—' }}</div>
                      <div class="text-[11px] text-slate-400 mt-0.5" dir="ltr">{{ tx.customerPhone }}</div>
                    </td>
                    <td class="text-sm text-slate-700 max-w-[14rem]">
                      <span class="break-words">{{ tx.clothingCodes }}</span>
                    </td>
                    <td>
                      <span
                        class="inline-flex text-[11px] font-medium px-2 py-0.5 rounded"
                        :class="PAYMENT_BUCKET_CLASS[tx.paymentBucket || (txTab === 'pending' ? 'pending' : 'paid')]"
                      >
                        {{ PAYMENT_BUCKET_LABELS[tx.paymentBucket || (txTab === 'pending' ? 'pending' : 'paid')] }}
                      </span>
                      <div v-if="tx.zibalRef" class="text-[10px] text-slate-400 mt-1" dir="ltr">
                        ref {{ tx.zibalRef }}
                      </div>
                    </td>
                    <td class="data-num font-semibold whitespace-nowrap">{{ formatPrice(tx.totalPrice) }}</td>
                    <td>
                      <button
                        type="button"
                        class="text-xs text-primary-700 hover:underline"
                        @click="toggleExpand(tx.id)"
                      >
                        {{ expandedId === tx.id ? 'بستن' : 'لباس‌ها' }}
                      </button>
                    </td>
                  </tr>
                  <tr v-if="expandedId === tx.id" class="bg-slate-50/80">
                    <td colspan="6" class="!py-3">
                      <div class="space-y-2 text-sm">
                        <div
                          v-for="(item, idx) in tx.items"
                          :key="`${tx.id}-${idx}`"
                          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2"
                        >
                          <div class="min-w-0">
                            <p class="font-medium text-slate-800 truncate">{{ item.name }}</p>
                            <p class="text-[11px] text-slate-500 mt-0.5">
                              کد:
                              <span dir="ltr">{{ item.code || '—' }}</span>
                              · تعداد {{ formatNumber(item.quantity) }}
                            </p>
                          </div>
                          <p class="font-semibold text-slate-800 whitespace-nowrap">
                            {{ formatPrice(item.lineTotal) }}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </template>
              <tr v-else>
                <td colspan="6" class="text-center text-slate-500 py-8">
                  {{ txTab === 'paid' ? 'در این بازه فروش قطعی نیست.' : 'سفارش پرداخت‌نشده‌ای در این بازه نیست.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="px-4 pb-4">
          <AppPagination :pagination="txPagination" compact @update:page="goToTxPage" />
        </div>
      </div>

      <div class="mb-6">
        <div class="card p-4">
          <h2 class="font-semibold mb-1">فروش روزهای کاری (به‌جز جمعه)</h2>
          <p class="text-xs text-gray-500 mb-4">فقط درآمد قطعی · ساعت ایران</p>
          <div class="space-y-2 max-h-72 overflow-y-auto">
            <div v-for="day in dailyWithSales" :key="day.date" class="flex items-center gap-3">
              <span class="text-xs text-gray-500 w-24 shrink-0">{{ formatShortDate(day.date) }}</span>
              <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary-500 rounded-full"
                  :style="{ width: `${Math.round((day.revenue / maxDaily) * 100)}%` }"
                />
              </div>
              <span class="text-[11px] text-gray-400 w-10 text-center">{{ formatNumber(day.orders) }}</span>
              <span class="text-xs font-medium w-28 text-end">{{ formatPrice(day.revenue) }}</span>
            </div>
            <p v-if="!dailyWithSales.length" class="text-sm text-gray-500 py-4 text-center">
              در این بازه فروش قطعی ثبت نشده است.
            </p>
          </div>
        </div>
      </div>

      <div v-if="overview.monthly?.monthly?.length" class="card p-4 mb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="font-semibold">فروش ماهانه (قطعی)</h2>
            <p class="text-xs text-gray-500 mt-0.5">فقط درآمد قطعی · روزها با ساعت ایران</p>
          </div>
          <span v-if="overview.monthly.changePercent != null" class="text-sm text-gray-500">
            نسبت به ماه قبل:
            <b :class="overview.monthly.changePercent >= 0 ? 'text-green-600' : 'text-red-500'">
              {{ overview.monthly.changePercent }}٪
            </b>
          </span>
        </div>
        <div class="space-y-2">
          <div v-for="row in overview.monthly.monthly" :key="row.month" class="flex items-center gap-3">
            <span class="text-xs text-gray-500 w-24 shrink-0">{{ formatMonthYear(`${row.month}-01`) }}</span>
            <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                class="h-full bg-accent-500 rounded-full"
                :style="{ width: `${Math.round((row.revenue / maxMonthly) * 100)}%` }"
              />
            </div>
            <span class="text-[11px] text-gray-400 w-10 text-center">{{ formatNumber(row.orders) }}</span>
            <span class="text-xs font-medium w-28 text-end">{{ formatPrice(row.revenue) }}</span>
          </div>
        </div>
      </div>

      <div class="data-table-wrap p-0">
        <div class="px-4 pt-4 pb-2">
          <h2 class="font-semibold text-slate-800">پرفروش‌ترین محصولات</h2>
          <p class="text-xs text-gray-500 mt-0.5">فقط از سفارش‌های پرداخت‌شده</p>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>لباس</th>
                <th class="data-num">تعداد فروش</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in overview.topProducts" :key="item.name">
                <td class="font-medium text-slate-800">
                  {{ item.name }}
                  <span v-if="item.product?.barcode" class="text-[11px] text-slate-400 ms-2" dir="ltr">
                    {{ item.product.barcode }}
                  </span>
                </td>
                <td class="data-num font-semibold">{{ formatNumber(item.totalQuantity) }}</td>
              </tr>
              <tr v-if="!overview.topProducts?.length">
                <td colspan="2" class="text-center text-slate-500 py-6">محصولی در این بازه فروخته نشده.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
