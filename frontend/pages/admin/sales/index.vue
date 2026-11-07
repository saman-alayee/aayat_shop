<script setup lang="ts">

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const { formatPrice, formatNumber, formatShortDate, formatMonthYear, formatDate } = useFormat();

type SalesItem = {
  name: string;
  code: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type SalesTransaction = {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  totalPrice: number;
  clothingCodes: string;
  itemsSummary: string;
  items: SalesItem[];
};

const days = ref(30);
const dateFrom = ref<string | null>(null);
const dateTo = ref<string | null>(null);
const productSearch = ref('');
const loading = ref(true);
const expandedId = ref<string | null>(null);
const overview = ref<{
  totalRevenue: number;
  orderCount: number;
  avgOrder: number;
  avgPerCustomer: number;
  uniqueCustomers: number;
  daily: { date: string; revenue: number; orders: number }[];
  workingDays: { date: string; revenue: number; orders: number }[];
  topProducts: { name: string; totalQuantity: number; product?: { barcode?: string | null } | null }[];
  transactions: SalesTransaction[];
  monthly: {
    monthly: { month: string; revenue: number; orders: number }[];
    changePercent: number | null;
  };
} | null>(null);

async function load() {
  loading.value = true;
  expandedId.value = null;
  try {
    const params = new URLSearchParams();
    if (dateFrom.value || dateTo.value) {
      if (dateFrom.value) params.set('dateFrom', dateFrom.value);
      if (dateTo.value) params.set('dateTo', dateTo.value);
    } else {
      params.set('days', String(days.value));
    }
    if (productSearch.value.trim()) params.set('productSearch', productSearch.value.trim());
    const { data } = await api.get<typeof overview.value>(`/admin/sales/overview?${params}`);
    overview.value = data;
  } finally {
    loading.value = false;
  }
}

function applyPreset() {
  dateFrom.value = null;
  dateTo.value = null;
  void load();
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

useHead({ title: 'گزارش فروش - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-xl font-bold">گزارش فروش</h1>
        <p class="text-sm leading-6 text-gray-500 mt-1 max-w-2xl">
          هر تراکنش با تاریخ، ساعت، کد لباس‌ها، مبلغ و نام خریدار. با فیلتر تاریخ یا نام/کد لباس محدود کنید.
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
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div class="card p-4">
          <p class="text-xs text-gray-500">درآمد کل</p>
          <p class="text-lg font-bold mt-1">{{ formatPrice(overview.totalRevenue) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-xs text-gray-500">تعداد سفارش</p>
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
        <div class="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
          <h2 class="font-semibold text-slate-800">تراکنش‌ها</h2>
          <span class="text-xs text-gray-500">
            {{ formatNumber(overview.transactions?.length || 0) }} مورد
          </span>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>تاریخ و ساعت</th>
                <th>خریدار</th>
                <th>کد لباس‌ها</th>
                <th class="data-num">مبلغ</th>
                <th>جزئیات</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="overview.transactions?.length">
                <template v-for="tx in overview.transactions" :key="tx.id">
                  <tr>
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
                    <td colspan="5" class="!py-3">
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
                <td colspan="5" class="text-center text-slate-500 py-8">
                  در این بازه تراکنشی پیدا نشد.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="mb-6">
        <div class="card p-4">
          <h2 class="font-semibold mb-4">فروش روزهای کاری (به‌جز جمعه)</h2>
          <div class="space-y-2 max-h-72 overflow-y-auto">
            <div v-for="day in (overview.workingDays || overview.daily).slice().reverse()" :key="day.date" class="flex items-center gap-3">
              <span class="text-xs text-gray-500 w-24 shrink-0">{{ formatShortDate(day.date) }}</span>
              <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary-500 rounded-full"
                  :style="{ width: `${Math.round((day.revenue / maxDaily) * 100)}%` }"
                />
              </div>
              <span class="text-xs font-medium w-24 text-end">{{ formatPrice(day.revenue) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="overview.monthly?.monthly?.length" class="card p-4 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold">فروش ماهانه</h2>
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
            <span class="text-xs font-medium w-28 text-end">{{ formatPrice(row.revenue) }}</span>
          </div>
        </div>
      </div>

      <div class="data-table-wrap p-0">
        <div class="px-4 pt-4 pb-2">
          <h2 class="font-semibold text-slate-800">پرفروش‌ترین محصولات</h2>
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
                <td class="font-medium text-slate-800">{{ item.name }}</td>
                <td class="data-num font-semibold">{{ formatNumber(item.totalQuantity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
