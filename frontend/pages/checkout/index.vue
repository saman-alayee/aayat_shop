<script setup lang="ts">
import type { Address } from '~/types';
import { SITE_NAME } from '~/constants/site';
import { SHIPPING_OPTIONS, type ShippingMethod } from '~/constants/shipping';
import { useOrdersStore } from '~/stores/orders';

const cartStore = useCartStore();
const ordersStore = useOrdersStore();
const authStore = useAuthStore();
const api = useApi();
const toast = useToast();
const { formatPrice } = useFormat();
const manualAddress = useAddressFields();
const { street, plaque, unit, province, city, postalCode, cityOptions, errors: addressErrors, validate: validateAddress, payload: manualPayload } = manualAddress;

const checkoutMode = ref<'quick' | 'account'>('quick');

const form = reactive({
  customerName: '',
  customerPhone: '',
  notes: '',
  couponCode: '',
  deliveryMethod: 'NATIONWIDE' as ShippingMethod,
});

const loading = ref(false);
const error = ref('');
const couponLoading = ref(false);
const addressesLoading = ref(false);
const addresses = ref<Address[]>([]);
const selectedAddressId = ref<string | null>(null);

const appliedCoupon = ref<{
  code: string;
  discountAmount: number;
  totalPrice: number;
} | null>(null);

const displaySubtotal = computed(() => appliedCoupon.value?.totalPrice ?? cartStore.totalPrice);
const displayDiscount = computed(() => appliedCoupon.value?.discountAmount ?? 0);
const selectedAddress = computed(() => addresses.value.find((a) => a.id === selectedAddressId.value) || null);
const deliveryFee = computed(
  () => SHIPPING_OPTIONS.find((item) => item.value === form.deliveryMethod)?.fee ?? 0,
);
const displayTotal = computed(() => displaySubtotal.value + deliveryFee.value);

function scrollToFirstError() {
  nextTick(() => {
    document.querySelector('[data-field-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

onMounted(async () => {
  await cartStore.fetchCart();
  if (cartStore.isEmpty) navigateTo('/cart');

  authStore.init();
  if (authStore.isLoggedIn) {
    await authStore.fetchProfile().catch(() => undefined);
    if (authStore.user) {
      form.customerName = authStore.fullName;
      form.customerPhone = authStore.user.phone;
    }
    await loadAddresses();
  }
});

async function loadAddresses() {
  addressesLoading.value = true;
  try {
    const { data } = await api.get<Address[]>('/addresses');
    addresses.value = data;
    const def = data.find((a) => a.isDefault) || data[0];
    if (def) selectedAddressId.value = def.id;
  } catch {
    addresses.value = [];
  } finally {
    addressesLoading.value = false;
  }
}

function switchToAccount() {
  checkoutMode.value = 'account';
  if (!authStore.isLoggedIn) {
    navigateTo(`/auth/login?redirect=${encodeURIComponent('/checkout')}`);
  }
}

async function applyCoupon() {
  if (!form.couponCode.trim() || !form.customerPhone.trim()) {
    error.value = 'برای اعمال کد تخفیف، شماره موبایل را وارد کنید';
    return;
  }
  couponLoading.value = true;
  error.value = '';
  try {
    const { data } = await api.post<{ code: string; discountAmount: number; totalPrice: number }>(
      '/coupons/validate',
      { code: form.couponCode, subtotal: cartStore.totalPrice, customerPhone: form.customerPhone }
    );
    appliedCoupon.value = data;
  } catch (e: unknown) {
    appliedCoupon.value = null;
    error.value = e instanceof Error ? e.message : 'کد تخفیف نامعتبر است';
  } finally {
    couponLoading.value = false;
  }
}

async function submitOrder() {
  error.value = '';

  if (form.customerName.trim().length < 3) {
    error.value = 'نام و نام خانوادگی را کامل وارد کنید';
    toast.error(error.value);
    return;
  }
  if (!/^09\d{9}$/.test(form.customerPhone.trim())) {
    error.value = 'شماره موبایل معتبر نیست';
    toast.error(error.value);
    return;
  }

  let deliveryPayload: Record<string, unknown> = {};

  if (checkoutMode.value === 'account' && authStore.isLoggedIn) {
    if (!selectedAddress.value) {
      error.value = 'یک آدرس ذخیره‌شده انتخاب کنید';
      toast.error(error.value);
      scrollToFirstError();
      return;
    }
    deliveryPayload = {
      addressId: selectedAddress.value.id,
      deliveryAddress: selectedAddress.value.address,
      province: selectedAddress.value.province || undefined,
      city: selectedAddress.value.city || undefined,
      postalCode: selectedAddress.value.postalCode || undefined,
    };
  } else {
    if (!validateAddress()) {
      error.value = 'استان، شهر، آدرس و کدپستی را کامل کنید';
      toast.error(error.value);
      scrollToFirstError();
      return;
    }
    deliveryPayload = {
      ...manualPayload(),
    };
  }

  loading.value = true;
  try {
    const payload = {
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      notes: form.notes.trim() || undefined,
      couponCode: appliedCoupon.value?.code || undefined,
      deliveryMethod: form.deliveryMethod,
      ...deliveryPayload,
    };

    const { data } = await api.post<{ orderNumber: string }>('/orders', payload);
    await cartStore.fetchCart();
    await ordersStore.fetchCount();
    navigateTo(`/orders/success?number=${data.orderNumber}`);
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'خطا در ثبت سفارش';
    toast.error(error.value);
  } finally {
    loading.value = false;
  }
}

useHead({ title: `ثبت سفارش - ${SITE_NAME}` });
</script>

<template>
  <div class="px-4 py-4 max-w-lg md:max-w-2xl mx-auto pb-44 md:pb-32">
    <h1 class="section-title">ثبت سفارش</h1>

    <div class="card p-4 mb-4 space-y-2">
      <div class="flex justify-between text-sm">
        <span class="text-gray-600">{{ cartStore.totalItems }} کالا</span>
        <span>{{ formatPrice(cartStore.totalPrice) }}</span>
      </div>
      <div v-if="displayDiscount" class="flex justify-between text-sm text-green-600">
        <span>تخفیف</span><span>- {{ formatPrice(displayDiscount) }}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span>هزینه ارسال</span><span>{{ formatPrice(deliveryFee) }}</span>
      </div>
      <div class="flex justify-between pt-2 border-t font-bold">
        <span>مبلغ قابل پرداخت</span>
        <span class="text-lg">{{ formatPrice(displayTotal) }}</span>
      </div>
    </div>

    <div class="mb-6 flex gap-6 border-b border-neutral-200">
      <button
        type="button"
        :class="['-mb-px border-b pb-2 text-sm', checkoutMode === 'quick' ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-400']"
        @click="checkoutMode = 'quick'"
      >
        خرید سریع
      </button>
      <button
        type="button"
        :class="['-mb-px border-b pb-2 text-sm', checkoutMode === 'account' ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-400']"
        @click="switchToAccount"
      >
        ورود | ثبت‌نام
      </button>
    </div>

    <form class="space-y-4" @submit.prevent="submitOrder">
      <div>
        <label class="field-label">نام و نام خانوادگی</label>
        <input v-model="form.customerName" type="text" required minlength="3" class="input-field" />
      </div>
      <div>
        <label class="field-label">شماره موبایل</label>
        <input v-model="form.customerPhone" type="tel" required pattern="09[0-9]{9}" class="input-field" dir="ltr" />
      </div>

      <div v-if="checkoutMode === 'quick'" class="space-y-3" data-field-error="true">
        <AddressFields
          v-model:street="street"
          v-model:plaque="plaque"
          v-model:unit="unit"
          v-model:province="province"
          v-model:city="city"
          v-model:postal-code="postalCode"
          :city-options="cityOptions"
          :errors="addressErrors"
        />
        <p class="text-xs text-gray-500">
          ثبت‌نام لازم نیست. در صورت تمایل می‌توانید
          <button type="button" class="text-primary-600 font-medium" @click="switchToAccount">وارد حساب شوید</button>.
        </p>
      </div>

      <div v-else class="space-y-3">
        <LoadingSpinner :show="addressesLoading" />
        <template v-if="!addressesLoading && addresses.length">
          <p class="field-label">آدرس ذخیره‌شده</p>
          <button
            v-for="addr in addresses"
            :key="addr.id"
            type="button"
            :class="[
              'w-full border-b border-neutral-200 py-3 text-start',
              selectedAddressId === addr.id ? 'text-neutral-950' : 'text-neutral-500',
            ]"
            @click="selectedAddressId = addr.id"
          >
            <p class="text-sm font-medium">{{ addr.title || 'آدرس' }}</p>
            <p class="text-xs text-gray-600 mt-1">{{ addr.address }}</p>
            <p v-if="addr.province || addr.city || addr.postalCode" class="mt-1 text-xs text-gray-500">
              <span v-if="addr.province">{{ addr.province }}</span>
              <span v-if="addr.city">، {{ addr.city }}</span>
              <span v-if="addr.postalCode">، کدپستی {{ addr.postalCode }}</span>
            </p>
          </button>
        </template>
        <div v-else-if="!addressesLoading" class="space-y-2">
          <AppAlertBanner message="آدرسی ذخیره نشده. از خرید سریع استفاده کنید یا آدرس اضافه کنید." variant="warning" />
          <NuxtLink to="/profile/addresses" class="btn-secondary w-full inline-flex justify-center min-h-[44px] items-center">افزودن آدرس</NuxtLink>
        </div>
      </div>

      <div class="space-y-1">
        <p class="field-label">روش ارسال</p>
        <label
          v-for="option in SHIPPING_OPTIONS"
          :key="option.value"
          class="flex cursor-pointer items-center justify-between gap-4 border-b border-neutral-200 py-3"
        >
          <span>
            <span class="block text-sm text-neutral-900">{{ option.label }}</span>
            <span class="mt-0.5 block text-xs text-neutral-500">
              {{ option.hint }}<template v-if="option.fee"> — {{ formatPrice(option.fee) }}</template>
            </span>
          </span>
          <input v-model="form.deliveryMethod" type="radio" :value="option.value" />
        </label>
      </div>

      <div>
        <label class="field-label">توضیحات</label>
        <textarea v-model="form.notes" rows="2" class="input-field resize-none" />
      </div>

      <AppAlertBanner v-if="error" :message="error" />
    </form>

    <div class="fixed bottom-16 md:bottom-0 inset-x-0 z-[55] border-t bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
      <div v-if="error" class="mx-auto mb-2 max-w-lg md:max-w-2xl md:hidden"><AppAlertBanner :message="error" /></div>
      <div class="mx-auto max-w-lg md:max-w-2xl">
        <button type="button" class="btn-primary btn-action w-full" :disabled="loading" @click="submitOrder">
          {{ loading ? 'در حال ثبت...' : `ثبت سفارش • ${formatPrice(displayTotal)}` }}
        </button>
      </div>
    </div>
  </div>
</template>
