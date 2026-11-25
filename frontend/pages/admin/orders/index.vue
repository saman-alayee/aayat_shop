<script setup lang="ts">
import type { Order, OrderStatus, Pagination } from '~/types';
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, getOrderPaymentUi } from '~/types';
import { shippingLabel } from '~/constants/shipping';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const route = useRoute();
const api = useApi();
const toast = useToast();
const { formatPrice, formatDate, formatShortDate, getProductImage, toPersianDigits } = useFormat();

function shipRequestDate(order: Order): string | null {
  const raw = order.paymentDetails?.requestedShipDate;
  return typeof raw === 'string' && raw ? raw : null;
}

type PreparingCloth = {
  key: string;
  name: string;
  barcode: string | null;
  image: string | null;
  quantity: number;
  purchasedAt: string;
  orderId: string;
  orderNumber: string;
};

type PreparingGroup = {
  key: string;
  customerName: string;
  customerPhone: string;
  requestedShipDate: string | null;
  deliveryMethods: string[];
  orders: Order[];
  clothes: PreparingCloth[];
};

const orders = ref<Order[]>([]);
const pagination = ref<Pagination | null>(null);
const page = ref(1);
const loading = ref(true);
const search = ref(typeof route.query.search === 'string' ? route.query.search : '');
const statusFilter = ref((route.query.status as OrderStatus) || '');
const dateFrom = ref<string | null>(null);
const dateTo = ref<string | null>(null);
const selectedOrder = ref<Order | null>(null);
const selectedGroup = ref<PreparingGroup | null>(null);
const statusNote = ref('');
const statusError = ref('');

const statusOptions: OrderStatus[] = ['NEW', 'REVIEWING', 'PREPARING', 'SHIPPED', 'CANCELLED'];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  NEW: ['PREPARING', 'CANCELLED'],
  REVIEWING: ['NEW', 'PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['CANCELLED'],
};

const STATUS_HINTS: Partial<Record<OrderStatus, string>> = {
  REVIEWING: 'هنوز پول نیامده — منتظر درگاه / تأیید پرداخت',
  NEW: 'پول آمده. مشتری تا مهلت تنظیم‌شده فرصت دارد ارسال را بزند؛ بعد از مهلت خودکار برای ارسال ثبت می‌شود',
  SHIPPED: 'پیام «تحویل به پیک» به مشتری ارسال می‌شود',
  PREPARING: 'مشتری ارسال را زده. بسته‌بندی کنید و پست کنید',
  CANCELLED: 'سفارش لغو می‌شود',
};

const STATUS_ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  NEW: 'تأیید پرداخت / خریداری شده',
  PREPARING: 'درخواست ارسال',
  SHIPPED: 'ارسال شده',
  CANCELLED: 'لغو سفارش',
};

const showPreparingGroups = computed(() => statusFilter.value === 'PREPARING');

function deliveryMethodOf(order: Order): string {
  return String(order.paymentDetails?.deliveryMethod || '');
}

function isPickupOrder(order: Order) {
  return deliveryMethodOf(order) === 'PICKUP';
}

function deliveryBadgeClass(order: Order) {
  if (isPickupOrder(order)) return 'bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200';
  if (deliveryMethodOf(order) === 'NATIONWIDE') {
    return 'bg-violet-100 text-violet-800 ring-1 ring-inset ring-violet-200';
  }
  return 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200';
}

const preparingGroups = computed((): PreparingGroup[] => {
  if (!showPreparingGroups.value) return [];
  const map = new Map<string, PreparingGroup>();
  for (const order of orders.value) {
    const shipDate = shipRequestDate(order) || 'none';
    const method = deliveryMethodOf(order) || 'UNKNOWN';
    // حضوری و پستی جدا گروه شوند تا قاطی نشوند
    const key = `${order.customerPhone}|${shipDate}|${method}`;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        customerName: order.customerName,
        customerPhone: order.customerPhone || '',
        requestedShipDate: shipRequestDate(order),
        deliveryMethods: [method === 'UNKNOWN' ? '' : method],
        orders: [],
        clothes: [],
      };
      map.set(key, group);
    }
    group.orders.push(order);
    for (const item of order.items || []) {
      group.clothes.push({
        key: `${order.id}-${item.id}`,
        name: item.name,
        barcode: item.product?.barcode ?? null,
        image: item.product?.image ?? null,
        quantity: item.quantity,
        purchasedAt: order.createdAt,
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }
  }
  return [...map.values()].map((group) => ({
    ...group,
    clothes: group.clothes
      .slice()
      .sort((a, b) => String(a.purchasedAt).localeCompare(String(b.purchasedAt))),
  }));
});

function clothesQty(group: PreparingGroup) {
  return group.clothes.reduce((sum, cloth) => sum + (cloth.quantity || 0), 0);
}

function findGroupForOrder(order: Order): PreparingGroup | null {
  return (
    preparingGroups.value.find((group) => group.orders.some((o) => o.id === order.id)) || null
  );
}

function openGroup(group: PreparingGroup) {
  selectedOrder.value = null;
  selectedGroup.value = group;
}

function closeGroup() {
  selectedGroup.value = null;
}

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
  if (statusFilter.value === 'DELIVERED') statusFilter.value = '';
  await loadOrders();
  const openId = typeof route.query.open === 'string' ? route.query.open : '';
  if (openId) await openOrder(openId);
});

async function loadOrders() {
  loading.value = true;
  try {
    // درخواست ارسال: همه صفحات را بگیر تا لباس‌های همه خریدها یکجا کامل باشند
    if (statusFilter.value === 'PREPARING') {
      const all: Order[] = [];
      let pageNo = 1;
      let totalPages = 1;
      do {
        const params = new URLSearchParams();
        params.set('page', String(pageNo));
        params.set('limit', '100');
        params.set('status', 'PREPARING');
        if (search.value) params.set('search', search.value);
        if (dateFrom.value) params.set('dateFrom', dateFrom.value);
        if (dateTo.value) params.set('dateTo', dateTo.value);
        const { data } = await api.get<{ orders: Order[]; pagination: Pagination }>(
          `/admin/orders?${params}`
        );
        all.push(...(data.orders || []));
        totalPages = data.pagination?.totalPages || 1;
        pageNo += 1;
      } while (pageNo <= totalPages && pageNo <= 20);
      orders.value = all;
      pagination.value = {
        page: 1,
        limit: all.length,
        total: all.length,
        totalPages: 1,
      };
      return;
    }

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

async function toggleGroupPacked(group: PreparingGroup) {
  const allPacked = group.orders.every((o) => isPacked(o));
  for (const order of group.orders) {
    if (isPacked(order) === allPacked) {
      await togglePacked(order);
    }
  }
}

function printGroup(group: PreparingGroup) {
  for (const order of group.orders) {
    printOrderSlip(order.id);
  }
}

function goToPage(next: number) {
  page.value = next;
  void loadOrders();
}

async function openOrder(orderId: string) {
  statusError.value = '';
  // در فیلتر درخواست ارسال، به‌جای یک سفارش، کل لباس‌های گروه را نشان بده
  if (showPreparingGroups.value) {
    const local = orders.value.find((o) => o.id === orderId);
    const group = local ? findGroupForOrder(local) : null;
    if (group) {
      openGroup(group);
      return;
    }
  }
  selectedGroup.value = null;
  const { data } = await api.get<Order>(`/admin/orders/${orderId}`);
  selectedOrder.value = data;
  statusNote.value = '';
}

function closeOrder() {
  selectedOrder.value = null;
  selectedGroup.value = null;
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

const packingIds = ref<Set<string>>(new Set());

function isPacked(order: Order) {
  return Boolean(order.packedAt);
}

async function togglePacked(order: Order) {
  if (packingIds.value.has(order.id)) return;
  const next = !isPacked(order);
  packingIds.value = new Set(packingIds.value).add(order.id);
  try {
    const { data } = await api.put<Order>(`/admin/orders/${order.id}/packed`, { packed: next });
    const idx = orders.value.findIndex((o) => o.id === order.id);
    if (idx >= 0) {
      orders.value[idx] = { ...orders.value[idx], packedAt: data.packedAt ?? null };
    }
    if (selectedOrder.value?.id === order.id) {
      selectedOrder.value = { ...selectedOrder.value, packedAt: data.packedAt ?? null };
    }
    toast.success(next ? 'علامت تکمیل شد — بدون پیامک' : 'علامت تکمیل برداشته شد');
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ثبت تکمیل');
  } finally {
    const nextSet = new Set(packingIds.value);
    nextSet.delete(order.id);
    packingIds.value = nextSet;
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
        نوع ارسال روی هر سفارش مشخص است: <b>تحویل حضوری</b> یا <b>ارسال به سراسر ایران (پست)</b>.
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

    <!-- درخواست ارسال: همه لباس‌ها با تاریخ خرید متفاوت یکجا برای هر مشتری -->
    <div v-if="!loading && showPreparingGroups" class="space-y-4">
      <article
        v-for="group in preparingGroups"
        :key="group.key"
        class="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-base font-bold text-slate-800">{{ group.customerName }}</p>
            <p class="text-sm text-slate-500" dir="ltr">{{ group.customerPhone }}</p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <span
                v-for="method in group.deliveryMethods"
                :key="`${group.key}-${method || 'x'}`"
                class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold"
                :class="deliveryBadgeClass({ paymentDetails: { deliveryMethod: method || undefined } } as Order)"
              >
                {{ method === 'PICKUP' ? 'تحویل حضوری — نیاید پست' : method === 'NATIONWIDE' ? 'ارسال پستی — پست کنید' : shippingLabel(method) }}
              </span>
            </div>
            <p v-if="group.requestedShipDate" class="mt-1 text-sm font-bold text-amber-900">
              تاریخ درخواست ارسال (روی کل):
              {{ formatShortDate(group.requestedShipDate) }}
            </p>
            <p class="mt-0.5 text-xs text-slate-400">
              {{ toPersianDigits(clothesQty(group)) }} لباس ·
              {{ toPersianDigits(group.orders.length) }} خرید
            </p>
          </div>
          <div class="admin-actions admin-actions--orders" @click.stop>
            <button type="button" class="admin-btn-secondary" @click="openGroup(group)">
              همه لباس‌ها
            </button>
            <button
              type="button"
              :class="group.orders.every((o) => isPacked(o)) ? 'admin-btn-packed' : 'admin-btn-secondary'"
              @click="toggleGroupPacked(group)"
            >
              تکمیل شده
            </button>
            <button type="button" class="admin-btn-secondary" @click="printGroup(group)">
              <AppIcon name="lucide:printer" size="sm" />
              چاپ
            </button>
          </div>
        </div>

        <ul class="mt-4 divide-y divide-amber-100 rounded-xl border border-amber-100 bg-amber-50/40">
          <li
            v-for="(cloth, idx) in group.clothes"
            :key="cloth.key"
            class="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-amber-50"
            @click="openGroup(group)"
          >
            <img
              :src="getProductImage(cloth.image)"
              :alt="cloth.name"
              class="h-14 w-14 shrink-0 rounded-lg border border-amber-100 bg-white object-cover"
              loading="lazy"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-slate-800">
                <span class="me-1 text-xs font-normal text-slate-400">{{ toPersianDigits(idx + 1) }}.</span>
                {{ cloth.name }}
              </p>
              <p class="mt-0.5 text-xs font-semibold text-amber-900">
                تاریخ خرید: {{ formatShortDate(cloth.purchasedAt) }}
              </p>
              <p v-if="cloth.barcode" class="mt-0.5 text-xs tabular-nums text-primary-700" dir="ltr">
                کد: {{ cloth.barcode }}
              </p>
            </div>
            <span class="shrink-0 text-xs text-slate-400">{{ toPersianDigits(cloth.quantity) }} عدد</span>
          </li>
        </ul>
        <p class="mt-2 text-center text-xs font-medium text-amber-800">
          همه {{ toPersianDigits(clothesQty(group)) }} لباس در لیست بالا هستند — برای جزئیات کامل روی «همه لباس‌ها» بزنید
        </p>
      </article>
      <EmptyState v-if="!preparingGroups.length" message="درخواست ارسالی نیست" class="py-10" />
    </div>

    <!-- موبایل: کارت مرتب با تاریخ خرید و تاریخ درخواست ارسال -->
    <div v-if="!loading && !showPreparingGroups" class="space-y-3 md:hidden">
      <article
        v-for="order in orders"
        :key="`m-${order.id}`"
        class="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
        @click="openOrder(order.id)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-bold tabular-nums text-slate-800" dir="ltr">{{ order.orderNumber }}</p>
            <p class="mt-0.5 text-sm font-medium text-slate-700">{{ order.customerName }}</p>
            <p class="text-xs text-slate-400" dir="ltr">{{ order.customerPhone }}</p>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <OrderStatusBadge :status="order.status" />
            <span
              class="inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"
              :class="deliveryBadgeClass(order)"
            >
              {{ isPickupOrder(order) ? 'تحویل حضوری' : deliveryMethodOf(order) === 'NATIONWIDE' ? 'ارسال پستی' : deliveryLabel(order) }}
            </span>
            <span v-if="isPacked(order)" class="admin-badge-success">تکمیل شده</span>
          </div>
        </div>

        <div class="mt-3 space-y-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5">
          <p class="font-medium text-slate-700">
            تاریخ خرید:
            <span class="text-slate-900">{{ formatShortDate(order.createdAt) }}</span>
          </p>
          <p v-if="shipRequestDate(order)" class="font-bold text-amber-900">
            تاریخ درخواست ارسال (کل سفارش):
            {{ formatShortDate(shipRequestDate(order)!) }}
          </p>
          <p v-if="orderCodes(order).length" class="tabular-nums text-primary-700" dir="ltr">
            {{ orderCodes(order).join(' · ') }}
          </p>
          <p class="truncate text-slate-400">{{ orderItemSummary(order) }}</p>
        </div>

        <div class="admin-actions admin-actions--orders mt-3" @click.stop>
          <button type="button" class="admin-btn-secondary" @click="openOrder(order.id)">جزئیات</button>
          <button
            type="button"
            :class="isPacked(order) ? 'admin-btn-packed' : 'admin-btn-secondary'"
            :disabled="packingIds.has(order.id)"
            @click="togglePacked(order)"
          >
            تکمیل شده
          </button>
          <button
            type="button"
            class="admin-btn-secondary admin-actions__print"
            @click="printOrderSlip(order.id)"
          >
            <AppIcon name="lucide:printer" size="sm" />
            چاپ
          </button>
        </div>
      </article>
      <EmptyState v-if="!orders.length" message="سفارشی یافت نشد" class="py-10" />
    </div>

    <div v-if="!loading && !showPreparingGroups" class="data-table-wrap hidden md:block">
      <table class="data-table min-w-[1100px]">
        <thead>
          <tr>
            <th>شماره سفارش</th>
            <th>مشتری</th>
            <th>کد لباس</th>
            <th>تاریخ خرید</th>
            <th>تاریخ درخواست ارسال</th>
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
            <td class="whitespace-nowrap text-slate-500">{{ formatShortDate(order.createdAt) }}</td>
            <td class="whitespace-nowrap">
              <span v-if="shipRequestDate(order)" class="font-semibold text-amber-800">
                {{ formatShortDate(shipRequestDate(order)!) }}
              </span>
              <span v-else class="text-slate-300">—</span>
            </td>
            <td class="data-num font-semibold text-slate-800">{{ formatPrice(order.totalPrice) }}</td>
            <td class="whitespace-nowrap">
              <OrderPaymentBadge :order="order" />
            </td>
            <td class="whitespace-nowrap">
              <span
                class="inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                :class="deliveryBadgeClass(order)"
              >
                {{ isPickupOrder(order) ? 'تحویل حضوری' : deliveryMethodOf(order) === 'NATIONWIDE' ? 'ارسال پستی' : deliveryLabel(order) }}
              </span>
            </td>
            <td class="whitespace-nowrap">
              <OrderStatusBadge :status="order.status" />
            </td>
            <td class="data-actions">
              <div class="admin-actions admin-actions--orders" @click.stop>
                <button type="button" class="admin-btn-secondary" @click="openOrder(order.id)">جزئیات</button>
                <button
                  type="button"
                  :class="isPacked(order) ? 'admin-btn-packed' : 'admin-btn-secondary'"
                  :disabled="packingIds.has(order.id)"
                  :title="isPacked(order) ? 'لباس‌ها جمع شده — برای برداشتن علامت دوباره بزنید' : 'لباس‌های این سفارش را جمع کردیم (بدون پیامک)'"
                  @click="togglePacked(order)"
                >
                  تکمیل شده
                </button>
                <button
                  type="button"
                  class="admin-btn-secondary admin-actions__print"
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
      v-if="!loading && !showPreparingGroups && pagination && pagination.totalPages > 1"
      :pagination="pagination"
      compact
      class="mt-6"
      @update:page="goToPage"
    />

    <!-- Group detail: همه لباس‌های درخواست ارسال یکجا -->
    <div
      v-if="selectedGroup && !selectedOrder"
      class="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4"
      @click.self="closeGroup"
    >
      <div class="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-xl">
        <div class="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h2 class="font-bold text-lg truncate">{{ selectedGroup.customerName }}</h2>
            <p class="text-sm text-slate-500" dir="ltr">{{ selectedGroup.customerPhone }}</p>
            <p class="mt-1 text-sm font-bold text-amber-900">
              {{ toPersianDigits(clothesQty(selectedGroup)) }} لباس از
              {{ toPersianDigits(selectedGroup.orders.length) }} خرید
            </p>
            <p v-if="selectedGroup.requestedShipDate" class="text-xs text-amber-800">
              تاریخ درخواست ارسال: {{ formatShortDate(selectedGroup.requestedShipDate) }}
            </p>
          </div>
          <button
            type="button"
            class="p-2 rounded-xl hover:bg-gray-100 text-gray-500 shrink-0"
            aria-label="بستن"
            @click="closeGroup"
          >
            <AppIcon name="lucide:x" size="lg" />
          </button>
        </div>

        <div class="p-4">
          <div class="mb-3 flex flex-wrap gap-1.5">
            <span
              v-for="method in selectedGroup.deliveryMethods"
              :key="`modal-${method || 'x'}`"
              class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold"
              :class="deliveryBadgeClass({ paymentDetails: { deliveryMethod: method || undefined } } as Order)"
            >
              {{ method === 'PICKUP' ? 'تحویل حضوری' : method === 'NATIONWIDE' ? 'ارسال پستی' : shippingLabel(method) }}
            </span>
          </div>

          <p class="mb-2 text-sm font-medium text-slate-700">
            همه لباس‌ها ({{ toPersianDigits(clothesQty(selectedGroup)) }})
          </p>
          <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200">
            <li
              v-for="(cloth, idx) in selectedGroup.clothes"
              :key="`g-${cloth.key}`"
              class="flex items-center gap-3 px-3 py-3 text-sm"
            >
              <img
                :src="getProductImage(cloth.image)"
                :alt="cloth.name"
                class="h-16 w-16 shrink-0 rounded-xl border border-slate-200 bg-slate-50 object-cover"
                loading="lazy"
              />
              <div class="min-w-0 flex-1">
                <p class="font-medium text-slate-800">
                  <span class="me-1 text-xs text-slate-400">{{ toPersianDigits(idx + 1) }}.</span>
                  {{ cloth.name }}
                </p>
                <p class="mt-1 text-xs font-semibold text-amber-900">
                  تاریخ خرید: {{ formatShortDate(cloth.purchasedAt) }}
                </p>
                <p v-if="cloth.barcode" class="mt-0.5 text-xs tabular-nums text-primary-700" dir="ltr">
                  کد: {{ cloth.barcode }}
                </p>
                <p class="mt-0.5 text-[11px] text-slate-400" dir="ltr">{{ cloth.orderNumber }}</p>
              </div>
              <span class="shrink-0 text-xs text-slate-500">{{ toPersianDigits(cloth.quantity) }} عدد</span>
            </li>
          </ul>

          <div class="mt-4 flex flex-col gap-2">
            <button
              type="button"
              class="btn-secondary w-full text-sm"
              :class="selectedGroup.orders.every((o) => isPacked(o)) ? 'admin-btn-packed !py-2.5' : ''"
              @click="toggleGroupPacked(selectedGroup)"
            >
              {{ selectedGroup.orders.every((o) => isPacked(o)) ? 'تکمیل شده ✓' : 'علامت تکمیل شده' }}
            </button>
            <button type="button" class="btn-secondary w-full text-sm" @click="printGroup(selectedGroup)">
              چاپ همه فیش‌ها
            </button>
          </div>
        </div>
      </div>
    </div>

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
              <span v-if="isPacked(selectedOrder)" class="admin-badge-success">تکمیل شده</span>
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
            <p
              class="font-bold"
              :class="isPickupOrder(selectedOrder) ? 'text-sky-800' : 'text-violet-800'"
            >
              {{
                isPickupOrder(selectedOrder)
                  ? 'تحویل حضوری — مشتری می‌آید فروشگاه'
                  : deliveryMethodOf(selectedOrder) === 'NATIONWIDE'
                    ? 'ارسال پستی — با پست بفرستید'
                    : deliveryLabel(selectedOrder)
              }}
            </p>
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
          <p class="text-sm font-medium mb-2">
            اقلام این سفارش ({{ toPersianDigits(selectedOrder.items.length) }})
          </p>
          <div class="space-y-2">
            <div
              v-for="(item, idx) in selectedOrder.items"
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
                <p class="text-sm font-medium text-gray-800 leading-snug">
                  <span class="me-1 text-xs text-gray-400">{{ toPersianDigits(idx + 1) }}.</span>
                  {{ item.name }}
                </p>
                <p class="text-xs text-gray-500 mt-0.5">
                  تعداد: {{ toPersianDigits(item.quantity) }}
                </p>
                <p v-if="item.product?.barcode" class="text-xs font-semibold text-primary-700" dir="ltr">
                  کد: {{ item.product.barcode }}
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
            type="button"
            class="w-full text-sm"
            :class="isPacked(selectedOrder) ? 'admin-btn-packed !py-2.5 !text-sm' : 'btn-secondary'"
            :disabled="packingIds.has(selectedOrder.id)"
            @click="togglePacked(selectedOrder)"
          >
            {{ isPacked(selectedOrder) ? 'تکمیل شده ✓' : 'علامت تکمیل شده (بدون پیامک)' }}
          </button>
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
