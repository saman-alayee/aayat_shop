<script setup lang="ts">
import type { Order, OrderStatus, Pagination } from '~/types';
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, getOrderPaymentUi } from '~/types';
import { shippingLabel } from '~/constants/shipping';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const route = useRoute();
const api = useApi();
const toast = useToast();
const { formatPrice, formatDate, getProductImage, toPersianDigits } = useFormat();

const orders = ref<Order[]>([]);
const pagination = ref<Pagination | null>(null);
const page = ref(1);
const loading = ref(true);
const search = ref(typeof route.query.search === 'string' ? route.query.search : '');
const statusFilter = ref((route.query.status as OrderStatus) || '');
const dateFrom = ref<string | null>(null);
const dateTo = ref<string | null>(null);
const selectedOrder = ref<Order | null>(null);
const statusNote = ref('');
const statusError = ref('');

const statusOptions: OrderStatus[] = ['NEW', 'REVIEWING', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  NEW: ['PREPARING', 'CANCELLED'],
  REVIEWING: ['NEW', 'PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
};

const STATUS_HINTS: Partial<Record<OrderStatus, string>> = {
  REVIEWING: 'هنوز پول نیامده — منتظر درگاه / تأیید پرداخت',
  NEW: 'پول آمده. مشتری تا مهلت تنظیم‌شده فرصت دارد ارسال را بزند؛ بعد از مهلت خودکار برای ارسال ثبت می‌شود',
  SHIPPED: 'پیام «تحویل به پیک» به مشتری ارسال می‌شود',
  PREPARING: 'مشتری ارسال را زده. بسته‌بندی کنید و پست کنید',
  DELIVERED: 'سفارش تکمیل شد',
  CANCELLED: 'سفارش لغو می‌شود',
};

const STATUS_ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  NEW: 'تأیید پرداخت / خریداری شده',
  PREPARING: 'درخواست ارسال',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل داده شده',
  CANCELLED: 'لغو سفارش',
};

function deliveryLabel(order: Order) {
  return shippingLabel(order.paymentDetails?.deliveryMethod);
}

function paymentMethodLabel(order: Order) {
  if (!order.paymentMethod) return '—';
  return PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod;
}

function paymentDetailLine(order: Order) {
  const details = order.paymentDetails;
  const parts: string[] = [];
  if (details?.refNumber) parts.push(`پیگیری: ${details.refNumber}`);
  if (details?.trackId) parts.push(`زیبال: ${details.trackId}`);
  return parts.join(' · ');
}

function orderCodes(order: Order): string[] {
  const codes = (order.items || [])
    .map((item) => item.product?.barcode)
    .filter((code): code is string => Boolean(code));
  return [...new Set(codes)];
}

function orderItemSummary(order: Order): string {
  return (order.items || []).map((item) => item.name).filter(Boolean).join('، ');
}

onMounted(async () => {
  await loadOrders();
  const openId = typeof route.query.open === 'string' ? route.query.open : '';
  if (openId) await openOrder(openId);
});

async function loadOrders() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.set('page', String(page.value));
    params.set('limit', '20');
    if (statusFilter.value) params.set('status', statusFilter.value);
    if (search.value) params.set('search', search.value);
    if (dateFrom.value) params.set('dateFrom', dateFrom.value);
    if (dateTo.value) params.set('dateTo', dateTo.value);
    const { data } = await api.get<{ orders: Order[]; pagination: Pagination }>(`/admin/orders?${params}`);
    orders.value = data.orders;
    pagination.value = data.pagination;
    if (
      pagination.value &&
      pagination.value.totalPages > 0 &&
      page.value > pagination.value.totalPages
    ) {
      page.value = pagination.value.totalPages;
      await loadOrders();
    }
  } finally {
    loading.value = false;
  }
}

function goToPage(next: number) {
  page.value = next;
  void loadOrders();
}

async function openOrder(orderId: string) {
  statusError.value = '';
  const { data } = await api.get<Order>(`/admin/orders/${orderId}`);
  selectedOrder.value = data;
  statusNote.value = '';
}

function closeOrder() {
  selectedOrder.value = null;
  statusNote.value = '';
  statusError.value = '';
}

function printOrderSlip(orderId: string) {
  window.open(`/admin/orders/print/${orderId}`, '_blank', 'noopener');
}

async function updateStatus(orderId: string, status: OrderStatus) {
  statusError.value = '';
  try {
    await api.put(`/admin/orders/${orderId}/status`, {
      status,
      note: statusNote.value || undefined,
    });
    toast.success(`وضعیت به «${ORDER_STATUS_LABELS[status]}» تغییر کرد`);
    if (selectedOrder.value?.id === orderId) {
      await openOrder(orderId);
    }
    await loadOrders();
  } catch (e: unknown) {
    statusError.value = e instanceof Error ? e.message : 'خطا در تغییر وضعیت';
    toast.error(statusError.value);
  }
}

async function sendOrderSms(orderId: string) {
  try {
    await api.post(`/admin/orders/${orderId}/send-sms`);
    toast.success('پیامک ارسال شد');
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ارسال پیامک');
  }
}

function nextStatuses(status: OrderStatus) {
  return NEXT_STATUS[status] || [];
}

function searchOrders() {
  page.value = 1;
  void loadOrders();
}

watch(statusFilter, () => {
  page.value = 1;
  void loadOrders();
});
watch([dateFrom, dateTo], () => {
  page.value = 1;
  void loadOrders();
});

useHead({ title: 'سفارش‌ها - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-xl font-bold text-gray-800">مدیریت سفارش‌ها</h1>
      <p class="text-sm leading-6 text-gray-500 mt-1 max-w-3xl">
        ستون <b>پرداخت</b> می‌گوید پول آمده یا نه.
        «پرداخت نشده / منتظر پرداخت» یعنی هنوز از درگاه پول نیامده.
        «پرداخت شده / خریداری شده» یعنی پول آمده؛ مشتری تا مهلت (پیش‌فرض ۲ هفته) فرصت دارد ارسال را بزند — بعد از مهلت خودکار به درخواست ارسال می‌رود.
        «درخواست ارسال» یعنی مشتری دکمهٔ ارسال را زده و باید بسته‌بندی شود.
      </p>
    </div>

    <div class="flex flex-col md:flex-row gap-3 mb-4">
      <input
        v-model="search"
        type="search"
        class="input-field md:max-w-sm"
        placeholder="کد لباس ۵۶۰، شماره سفارش، نام، موبایل..."
        @keyup.enter="searchOrders"
      />
      <button class="btn-secondary text-sm" @click="searchOrders">جستجو</button>
      <AppDatePicker v-model="dateFrom" placeholder="از تاریخ" class="md:max-w-[180px]" />
      <AppDatePicker v-model="dateTo" placeholder="تا تاریخ" class="md:max-w-[180px]" :min="dateFrom" />
    </div>
    <p class="mb-4 text-xs text-slate-400">
      با کد لباس (مثلاً ۵۶۰) هم می‌توانید بفهمید مال کدام مشتری و کدام سفارش است. برای ارسال‌ها فیلتر «درخواست ارسال» یا «ارسال شده» را بزنید.
    </p>

    <div class="flex gap-2 overflow-x-auto mb-6">
      <button
        :class="['px-3 py-1.5 rounded-full text-sm whitespace-nowrap', !statusFilter ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600']"
        @click="statusFilter = ''"
      >
        همه
      </button>
      <button
        v-for="status in statusOptions"
        :key="status"
        :class="['px-3 py-1.5 rounded-full text-sm whitespace-nowrap', statusFilter === status ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600']"
        @click="statusFilter = status"
      >
        {{ ORDER_STATUS_LABELS[status] }}
      </button>
    </div>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading" class="data-table-wrap">
      <table class="data-table min-w-[1100px]">
        <thead>
          <tr>
            <th>شماره سفارش</th>
            <th>مشتری</th>
            <th>کد لباس</th>
            <th>تاریخ</th>
            <th class="data-num">مبلغ</th>
            <th>پرداخت</th>
            <th>ارسال</th>
            <th>وضعیت سفارش</th>
            <th class="data-actions">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="order in orders"
            :key="order.id"
            class="cursor-pointer"
            @click="openOrder(order.id)"
          >
            <td>
              <span class="font-bold text-slate-800 tabular-nums" dir="ltr">{{ order.orderNumber }}</span>
            </td>
            <td>
              <p class="font-medium text-slate-800">{{ order.customerName }}</p>
              <p class="text-xs text-slate-400 mt-0.5" dir="ltr">{{ order.customerPhone }}</p>
            </td>
            <td>
              <p v-if="orderCodes(order).length" class="font-semibold tabular-nums text-primary-700" dir="ltr">
                {{ orderCodes(order).join(' · ') }}
              </p>
              <p v-else class="text-xs text-slate-400">—</p>
              <p class="mt-0.5 max-w-[160px] truncate text-[11px] text-slate-400">{{ orderItemSummary(order) }}</p>
            </td>
            <td class="whitespace-nowrap text-slate-500">{{ formatDate(order.createdAt) }}</td>
            <td class="data-num font-semibold text-slate-800">{{ formatPrice(order.totalPrice) }}</td>
            <td>
              <div class="flex flex-col items-start gap-1">
                <OrderPaymentBadge :order="order" />
                <span class="text-[11px] text-slate-400">{{ paymentMethodLabel(order) }}</span>
              </div>
            </td>
            <td>
              <span class="admin-badge-info">{{ deliveryLabel(order) }}</span>
            </td>
            <td>
              <OrderStatusBadge :status="order.status" />
            </td>
            <td class="data-actions">
              <div class="admin-actions" @click.stop>
                <button type="button" class="admin-btn-secondary" @click="openOrder(order.id)">جزئیات</button>
                <button
                  type="button"
                  class="admin-btn-secondary"
                  title="چاپ فیش جمع‌آوری"
                  @click="printOrderSlip(order.id)"
                >
                  <AppIcon name="lucide:printer" size="sm" />
                  چاپ
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-if="!orders.length" message="سفارشی یافت نشد" class="py-10" />
    </div>

    <AppPagination
      v-if="!loading && pagination && pagination.totalPages > 1"
      :pagination="pagination"
      compact
      class="mt-6"
      @update:page="goToPage"
    />

    <!-- Order detail modal -->
    <div
      v-if="selectedOrder"
      class="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4"
      @click.self="closeOrder"
    >
      <div class="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-xl">
        <div class="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h2 class="font-bold text-lg truncate" dir="ltr">{{ selectedOrder.orderNumber }}</h2>
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <OrderPaymentBadge :order="selectedOrder" />
              <OrderStatusBadge :status="selectedOrder.status" />
            </div>
          </div>
          <button
            type="button"
            class="p-2 rounded-xl hover:bg-gray-100 text-gray-500 shrink-0"
            aria-label="چاپ فیش جمع‌آوری"
            @click="printOrderSlip(selectedOrder.id)"
          >
            <AppIcon name="lucide:printer" size="lg" />
          </button>
          <button
            type="button"
            class="p-2 rounded-xl hover:bg-gray-100 text-gray-500 shrink-0"
            aria-label="بستن"
            @click="closeOrder"
          >
            <AppIcon name="lucide:x" size="lg" />
          </button>
        </div>

        <div class="p-4 space-y-2 text-sm">
          <div
            class="rounded-xl border p-3"
            :class="{
              'border-emerald-200 bg-emerald-50/70': getOrderPaymentUi(selectedOrder) === 'paid',
              'border-orange-200 bg-orange-50/70': getOrderPaymentUi(selectedOrder) === 'pending',
              'border-red-200 bg-red-50/70': getOrderPaymentUi(selectedOrder) === 'failed',
              'border-slate-200 bg-slate-50': getOrderPaymentUi(selectedOrder) === 'cod',
            }"
          >
            <p class="text-xs text-gray-500 mb-1">وضعیت پول</p>
            <div class="flex flex-wrap items-center gap-2">
              <OrderPaymentBadge :order="selectedOrder" />
              <span class="text-sm text-gray-700">{{ paymentMethodLabel(selectedOrder) }}</span>
            </div>
            <p v-if="paymentDetailLine(selectedOrder)" class="mt-1 text-xs text-gray-500" dir="ltr">
              {{ paymentDetailLine(selectedOrder) }}
            </p>
            <p v-if="getOrderPaymentUi(selectedOrder) === 'pending'" class="mt-2 text-xs text-orange-800 leading-5">
              مشتری هنوز پرداخت را کامل نکرده (یا از درگاه برگشته). تا وقتی «پرداخت شده» نشود بسته‌بندی/پست نکنید.
              اگر مطمئنید پول آمده، وضعیت را به «خریداری شده» بزنید.
            </p>
          </div>

          <p><span class="text-gray-500">مشتری:</span> {{ selectedOrder.customerName }}</p>
          <p dir="ltr"><span class="text-gray-500">موبایل:</span> {{ selectedOrder.customerPhone }}</p>
          <div>
            <p class="text-gray-500 mb-1">آدرس تحویل:</p>
            <p v-if="selectedOrder.addressTitle" class="font-medium text-gray-800">{{ selectedOrder.addressTitle }}</p>
            <p class="leading-relaxed">{{ selectedOrder.deliveryAddress }}</p>
          </div>
          <p v-if="selectedOrder.couponCode"><span class="text-gray-500">کد تخفیف:</span> {{ selectedOrder.couponCode }}</p>

          <div class="rounded-xl border border-primary-100 bg-primary-50/50 p-3">
            <p class="text-xs text-gray-500 mb-0.5">نوع ارسال</p>
            <p class="font-bold text-primary-800">{{ deliveryLabel(selectedOrder) }}</p>
            <p v-if="selectedOrder.paymentDetails?.requestedShipDate" class="mt-1 text-sm text-primary-900">
              روز مراجعه مشتری: {{ formatDate(String(selectedOrder.paymentDetails.requestedShipDate)) }}
            </p>
            <p
              v-if="selectedOrder.status === 'NEW' && selectedOrder.shipRequestDaysLeft != null"
              class="mt-1 text-sm text-amber-900"
            >
              مهلت درخواست ارسال:
              <template v-if="selectedOrder.shipRequestDaysLeft > 0">
                {{ toPersianDigits(selectedOrder.shipRequestDaysLeft) }} روز مانده
              </template>
              <template v-else>تمام شده (خودکار ثبت می‌شود)</template>
              <span v-if="selectedOrder.shipRequestDeadlineDays" class="text-xs text-gray-500">
                از {{ toPersianDigits(selectedOrder.shipRequestDeadlineDays) }} روز
              </span>
            </p>
            <p
              v-if="selectedOrder.paymentDetails?.deliveryFee != null"
              class="text-xs text-gray-600 mt-1"
            >
              هزینه ارسال: {{ formatPrice(Number(selectedOrder.paymentDetails.deliveryFee)) }}
            </p>
          </div>

          <p v-if="selectedOrder.discountAmount">
            <span class="text-gray-500">تخفیف:</span> {{ formatPrice(selectedOrder.discountAmount) }}
          </p>
          <p class="font-bold text-base pt-2">{{ formatPrice(selectedOrder.totalPrice) }}</p>
        </div>

        <div v-if="selectedOrder.items?.length" class="px-4 pb-4 border-t pt-4">
          <p class="text-sm font-medium mb-2">اقلام</p>
          <div class="space-y-2">
            <div
              v-for="item in selectedOrder.items"
              :key="item.id"
              class="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-2"
            >
              <img
                :src="getProductImage(item.product?.image ?? null)"
                :alt="item.name"
                class="h-14 w-14 shrink-0 rounded-lg object-cover bg-white border border-gray-100"
                loading="lazy"
              />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-800 leading-snug">{{ item.name }}</p>
                <p class="text-xs text-gray-500 mt-0.5">
                  تعداد: {{ item.quantity }}
                  <template v-if="item.product?.barcode">
                    · کد
                    <span class="font-semibold text-primary-700" dir="ltr">{{ item.product.barcode }}</span>
                  </template>
                </p>
              </div>
              <span class="shrink-0 text-sm font-bold text-gray-800">
                {{ formatPrice(item.subtotal || item.price * item.quantity) }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="nextStatuses(selectedOrder.status).length" class="px-4 pb-4 border-t pt-4">
          <AppAlertBanner :message="statusError" class="mb-3" />

          <label class="block text-sm font-medium mb-2">یادداشت برای مشتری (اختیاری)</label>
          <textarea v-model="statusNote" rows="2" class="input-field text-sm resize-none mb-3" placeholder="مثلاً: پیک تا ۳۰ دقیقه دیگر می‌رسد" />

          <p class="text-sm font-medium mb-2">تغییر وضعیت</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="status in nextStatuses(selectedOrder.status)"
              :key="status"
              class="btn-primary text-sm"
              @click="updateStatus(selectedOrder!.id, status)"
            >
              {{ STATUS_ACTION_LABELS[status] || ORDER_STATUS_LABELS[status] }}
            </button>
          </div>
          <p v-for="status in nextStatuses(selectedOrder.status)" :key="`hint-${status}`" class="text-xs text-gray-400 mt-2">
            {{ STATUS_HINTS[status] }}
          </p>
        </div>

        <div class="px-4 pb-4 flex flex-col gap-2">
          <button
            class="btn-secondary w-full text-sm"
            @click="printOrderSlip(selectedOrder.id)"
          >
            چاپ فیش جمع‌آوری
          </button>
          <button
            v-if="selectedOrder.status === 'PREPARING' || selectedOrder.status === 'SHIPPED'"
            class="btn-secondary w-full text-sm"
            @click="sendOrderSms(selectedOrder.id)"
          >
            ارسال دوباره پیامک وضعیت
          </button>
        </div>

        <div v-if="selectedOrder.statusLogs?.length" class="px-4 pb-6 border-t pt-4">
          <p class="text-sm font-medium mb-2">تاریخچه</p>
          <div v-for="log in selectedOrder.statusLogs" :key="log.id" class="text-xs text-gray-500 py-1 border-b border-gray-50 last:border-0">
            {{ ORDER_STATUS_LABELS[log.status] }} — {{ formatDate(log.createdAt) }}
            <span v-if="log.note" class="block text-gray-400">{{ log.note }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
