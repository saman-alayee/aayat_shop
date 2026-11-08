<script setup lang="ts">
import {
  DEFAULT_THEME,
  THEME_PRESETS,
  normalizeThemeColors,
  type ThemeColors,
} from '~/utils/themeColors';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();

type SettingsTab = 'announcement' | 'shipping' | 'theme' | 'maintenance' | 'new-order-sms';

interface NewOrderSmsSettings {
  enabled: boolean;
  phones: string[];
  includePanelStaff: boolean;
  messageTemplate: string;
}

interface SmsCreditStatus {
  provider: 'melipayamak' | 'farazsms';
  configured: boolean;
  credit: number | null;
  creditRials: number | null;
  creditLabel: string;
  unit: 'rial' | null;
  lowCredit: boolean;
  warning: string | null;
}

const tabs: Array<{ id: SettingsTab; label: string; icon: string }> = [
  { id: 'announcement', label: 'متن بالای سایت', icon: 'lucide:megaphone' },
  { id: 'shipping', label: 'هزینه ارسال و سبد', icon: 'lucide:truck' },
  { id: 'theme', label: 'تم رنگی', icon: 'lucide:palette' },
  { id: 'maintenance', label: 'تعمیر فروشگاه', icon: 'lucide:scissors' },
  { id: 'new-order-sms', label: 'تنظیمات پیامک', icon: 'lucide:message-square-text' },
];

const activeTab = ref<SettingsTab>('announcement');
const loading = ref(true);
const maintenanceReady = ref(false);
const saving = ref(false);
const testing = ref(false);
const showGuide = ref(true);
const testPhone = ref('');
const smsCredit = ref<SmsCreditStatus | null>(null);
const smsCreditLoading = ref(false);

const maintenance = reactive({
  enabled: false,
  message: '',
});
const maintenanceSaving = ref(false);
const announcementText = ref('');
const announcementSaving = ref(false);
const shippingForm = reactive({
  nationwideFee: 0,
  nationwideHint: 'پرداخت هزینه پست در محل (هنگام تحویل) انجام می‌شود',
  cartHoldMinutes: 30,
});
const shippingSaving = ref(false);
const themeForm = reactive<ThemeColors>({ ...DEFAULT_THEME });
const themeSaving = ref(false);
const themeReady = ref(false);

const { saveTheme, apply } = useThemeSettings();

const themeGroups: Array<{
  title: string;
  fields: Array<{ key: keyof ThemeColors; label: string; hint?: string }>;
}> = [
  {
    title: 'پس‌زمینه',
    fields: [
      { key: 'pageBg', label: 'پس‌زمینه صفحات فروشگاه', hint: 'صفحات کاربری، سبد و پروفایل' },
      { key: 'adminPageBg', label: 'پس‌زمینه صفحات ادمین', hint: 'زمینه پنل مدیریت' },
      { key: 'surface', label: 'پس‌زمینه کارت‌ها', hint: 'جعبه‌ها و جدول‌ها' },
      { key: 'header', label: 'پس‌زمینه هدر و منو', hint: 'نوار بالا و سایدبار' },
    ],
  },
  {
    title: 'رنگ‌های اصلی',
    fields: [
      { key: 'primary', label: 'رنگ اصلی', hint: 'دکمه‌ها و لینک‌های برجسته' },
      { key: 'onPrimary', label: 'متن روی دکمه اصلی' },
      { key: 'accent', label: 'رنگ مکمل' },
    ],
  },
  {
    title: 'متن و خطوط',
    fields: [
      { key: 'text', label: 'متن اصلی' },
      { key: 'textMuted', label: 'متن کم‌رنگ' },
      { key: 'border', label: 'رنگ حاشیه' },
    ],
  },
];

const form = reactive({
  enabled: true,
  phonesText: '',
  includePanelStaff: false,
  messageTemplate: '',
});

const previewText = computed(() =>
  form.messageTemplate
    .split('{orderNumber}')
    .join('KK-1403-001')
    .split('{customerName}')
    .join('علی رضایی')
);

const phoneCount = computed(() =>
  form.phonesText
    .split(/[\n,،]+/)
    .map((p) => p.trim())
    .filter(Boolean).length
);

onMounted(async () => {
  await Promise.all([loadAnnouncement(), loadShipping(), loadThemeSettings(), loadMaintenance(), loadSettings()]);
});

async function loadAnnouncement() {
  try {
    const { data } = await api.get<{ text: string }>('/admin/settings/announcement');
    announcementText.value = data.text;
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در بارگذاری متن بالای سایت');
  }
}

async function saveAnnouncement() {
  announcementSaving.value = true;
  try {
    const { data } = await api.put<{ text: string }>('/admin/settings/announcement', {
      text: announcementText.value.trim(),
    });
    announcementText.value = data.text;
    toast.success('متن بالای سایت ذخیره شد');
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ذخیره');
  } finally {
    announcementSaving.value = false;
  }
}

async function loadShipping() {
  try {
    const { data } = await api.get<{ nationwideFee: number; nationwideHint: string; cartHoldMinutes: number }>(
      '/admin/settings/shipping'
    );
    shippingForm.nationwideFee = data.nationwideFee;
    shippingForm.nationwideHint = data.nationwideHint;
    shippingForm.cartHoldMinutes = data.cartHoldMinutes || 30;
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در بارگذاری تنظیمات ارسال');
  }
}

async function saveShipping() {
  shippingSaving.value = true;
  try {
    const { data } = await api.put<{ nationwideFee: number; nationwideHint: string; cartHoldMinutes: number }>(
      '/admin/settings/shipping',
      {
        nationwideFee: Number(shippingForm.nationwideFee) || 0,
        nationwideHint: shippingForm.nationwideHint.trim(),
        cartHoldMinutes: Number(shippingForm.cartHoldMinutes) || 30,
      }
    );
    shippingForm.nationwideFee = data.nationwideFee;
    shippingForm.nationwideHint = data.nationwideHint;
    shippingForm.cartHoldMinutes = data.cartHoldMinutes;
    toast.success('تنظیمات ارسال ذخیره شد');
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ذخیره');
  } finally {
    shippingSaving.value = false;
  }
}

async function loadThemeSettings() {
  try {
    const { data } = await api.get<ThemeColors>('/admin/settings/theme');
    Object.assign(themeForm, normalizeThemeColors(data));
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در بارگذاری تم رنگی');
  } finally {
    themeReady.value = true;
  }
}

function applyPreset(presetId: string) {
  const preset = THEME_PRESETS.find((p) => p.id === presetId);
  if (!preset) return;
  Object.assign(themeForm, { ...preset.colors });
}

watch(
  themeForm,
  () => {
    if (!themeReady.value) return;
    apply({ ...themeForm });
  },
  { deep: true }
);

async function saveThemeSettings() {
  themeSaving.value = true;
  try {
    const data = await saveTheme({ ...themeForm });
    Object.assign(themeForm, data);
    toast.success('تم رنگی ذخیره شد و روی کل سایت اعمال شد');
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ذخیره تم');
  } finally {
    themeSaving.value = false;
  }
}

async function loadMaintenance() {
  try {
    const { data } = await api.get<{ enabled: boolean; message: string }>('/admin/settings/maintenance');
    maintenance.enabled = data.enabled;
    maintenance.message = data.message;
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در بارگذاری حالت تعمیر');
  } finally {
    maintenanceReady.value = true;
  }
}

async function saveMaintenance() {
  maintenanceSaving.value = true;
  try {
    const { data } = await api.put<{ enabled: boolean; message: string }>('/admin/settings/maintenance', {
      enabled: maintenance.enabled,
      message: maintenance.message.trim(),
    });
    maintenance.enabled = data.enabled;
    maintenance.message = data.message;
    const gate = useMaintenanceGate();
    gate.invalidate();
    gate.enabled.value = data.enabled;
    gate.message.value = data.message;
    toast.success(data.enabled ? 'فروشگاه برای مشتریان بسته شد' : 'فروشگاه دوباره باز شد');
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ذخیره');
  } finally {
    maintenanceSaving.value = false;
  }
}

async function loadSmsCredit() {
  smsCreditLoading.value = true;
  try {
    const { data } = await api.get<SmsCreditStatus>('/admin/settings/sms-credit');
    smsCredit.value = data;
  } catch {
    smsCredit.value = null;
  } finally {
    smsCreditLoading.value = false;
  }
}

async function loadSettings() {
  loading.value = true;
  try {
    const [{ data }, _] = await Promise.all([
      api.get<NewOrderSmsSettings>('/admin/settings/new-order-sms'),
      loadSmsCredit(),
    ]);
    form.enabled = data.enabled;
    form.phonesText = data.phones.join('\n');
    form.includePanelStaff = data.includePanelStaff;
    form.messageTemplate = data.messageTemplate;
    if (!testPhone.value && data.phones.length) {
      testPhone.value = data.phones[0];
    }
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در بارگذاری تنظیمات');
  } finally {
    loading.value = false;
  }
}

function parsePhones(text: string): string[] {
  return text
    .split(/[\n,،]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function insertPlaceholder(key: '{orderNumber}' | '{customerName}') {
  form.messageTemplate = `${form.messageTemplate}${form.messageTemplate ? ' ' : ''}${key}`;
}

async function sendTestSms() {
  const phone = testPhone.value.trim();
  if (!phone) {
    toast.error('شماره موبایل برای تست وارد کنید');
    return;
  }
  if (!form.messageTemplate.trim()) {
    toast.error('متن پیامک خالی است');
    return;
  }

  testing.value = true;
  try {
    const res = await api.post<{ phone: string; preview: string; stub: boolean }>(
      '/admin/settings/new-order-sms/test',
      {
        phone,
        messageTemplate: form.messageTemplate.trim(),
      }
    );
    const msg = res.message || 'پیامک تست ارسال شد';
    toast.success(res.data.stub ? `${msg} — ${res.data.preview}` : msg);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ارسال پیامک تست');
  } finally {
    testing.value = false;
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    const { data } = await api.put<NewOrderSmsSettings>('/admin/settings/new-order-sms', {
      enabled: form.enabled,
      phones: parsePhones(form.phonesText),
      includePanelStaff: form.includePanelStaff,
      messageTemplate: form.messageTemplate.trim(),
    });
    form.enabled = data.enabled;
    form.phonesText = data.phones.join('\n');
    form.includePanelStaff = data.includePanelStaff;
    form.messageTemplate = data.messageTemplate;
    toast.success('تنظیمات ذخیره شد');
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در ذخیره');
  } finally {
    saving.value = false;
  }
}

useHead({ title: 'تنظیمات - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">تنظیمات</h1>
        <p class="text-sm text-gray-500 mt-1">متن بالای سایت، هزینه ارسال، تم رنگی، تعمیر فروشگاه و پیامک</p>
      </div>
      <button type="button" class="btn-secondary text-sm self-start" @click="showGuide = !showGuide">
        {{ showGuide ? 'بستن راهنما' : 'نمایش راهنما' }}
      </button>
    </div>

    <div class="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-px">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="admin-tab-btn inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px"
        :class="
          activeTab === tab.id
            ? 'border-primary-600 text-primary-700 bg-white shadow-sm'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        "
        @click="activeTab = tab.id"
      >
        <AppIcon :name="tab.icon" size="sm" />
        {{ tab.label }}
      </button>
    </div>

    <Transition name="admin-tab" mode="out-in">
    <div :key="activeTab" class="admin-tab-panel">
    <div v-if="activeTab === 'announcement'" class="bg-white rounded-xl border border-gray-100 p-6 space-y-4 max-w-2xl">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">نوار بالای فروشگاه</h2>
        <p class="text-sm text-gray-500 mt-1">این متن همان نوار تیرهٔ بالای همهٔ صفحات است. اگر خالی ذخیره شود، نوار مخفی می‌شود.</p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">متن</label>
        <input v-model="announcementText" type="text" maxlength="180" class="input-field" />
      </div>
      <div class="flex justify-end">
        <button type="button" class="btn-primary px-5 py-2.5 disabled:opacity-60" :disabled="announcementSaving" @click="saveAnnouncement">
          {{ announcementSaving ? 'در حال ذخیره…' : 'ذخیره متن' }}
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'shipping'" class="bg-white rounded-xl border border-gray-100 p-6 space-y-4 max-w-2xl">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">هزینه ارسال و زمان سبد</h2>
        <p class="text-sm text-gray-500 mt-1">
          متن «هزینه ارسال» در سبد و تسویه، و مدت نگهداری لباس‌های پرداخت‌نشده در سبد.
        </p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">زمان سبد خرید (دقیقه)</label>
        <input
          v-model.number="shippingForm.cartHoldMinutes"
          type="number"
          min="5"
          max="1440"
          step="5"
          class="input-field"
          dir="ltr"
        />
        <p class="mt-1 text-xs text-gray-500">
          در این مدت لباس برای بقیه «در حال خرید» قفل می‌شود؛ اگر پرداخت نشود از سبد حذف و دوباره آزاد می‌شود.
        </p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">هزینه ارسال در پرداخت آنلاین (تومان)</label>
        <input
          v-model.number="shippingForm.nationwideFee"
          type="number"
          min="0"
          max="10000000"
          step="1000"
          class="input-field"
          dir="ltr"
        />
        <p class="mt-1 text-xs text-gray-500">برای پرداخت در محل، این عدد را ۰ بگذارید.</p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">متن هزینه ارسال</label>
        <textarea
          v-model="shippingForm.nationwideHint"
          rows="3"
          maxlength="200"
          class="input-field resize-none"
          placeholder="مثلاً: پرداخت هزینه پست در محل (هنگام تحویل) انجام می‌شود"
        />
      </div>
      <div class="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
        پیش‌نمایش: {{ shippingForm.nationwideHint || '—' }}
        <span v-if="shippingForm.nationwideFee > 0" class="text-gray-500">
          — {{ shippingForm.nationwideFee.toLocaleString('fa-IR') }} تومان
        </span>
      </div>
      <div class="flex justify-end">
        <button
          type="button"
          class="btn-primary px-5 py-2.5 disabled:opacity-60"
          :disabled="shippingSaving || !shippingForm.nationwideHint.trim()"
          @click="saveShipping"
        >
          {{ shippingSaving ? 'در حال ذخیره…' : 'ذخیره تنظیمات ارسال' }}
        </button>
      </div>
    </div>

    <div
      v-if="activeTab === 'theme' && themeReady"
      class="bg-white rounded-xl border border-gray-100 p-6 space-y-6 max-w-2xl"
    >
      <div>
        <h2 class="text-lg font-semibold text-gray-900">تم رنگی کل سایت</h2>
        <p class="text-sm text-gray-500 mt-1">
          رنگ فروشگاه و پنل ادمین جداست. با جابه‌جایی رنگ، پیش‌نمایش همین‌جا دیده می‌شود؛ بعد از ذخیره برای همه کاربران می‌ماند.
        </p>
      </div>

      <div>
        <p class="text-sm font-medium text-gray-700 mb-2">پیش‌فرض‌های آماده</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <button
            v-for="preset in THEME_PRESETS"
            :key="preset.id"
            type="button"
            class="rounded-lg border border-gray-200 p-2.5 text-right hover:border-gray-400 transition-colors"
            @click="applyPreset(preset.id)"
          >
            <span class="flex gap-1 mb-2">
              <span
                class="h-5 w-5 rounded-full border border-black/10"
                :style="{ backgroundColor: preset.colors.primary }"
              />
              <span
                class="h-5 w-5 rounded-full border border-black/10"
                :style="{ backgroundColor: preset.colors.accent }"
              />
              <span
                class="h-5 w-5 rounded-full border border-black/10"
                :style="{ backgroundColor: preset.colors.pageBg }"
              />
            </span>
            <span class="text-xs font-medium text-gray-800">{{ preset.label }}</span>
          </button>
        </div>
      </div>

      <div v-for="group in themeGroups" :key="group.title" class="space-y-3">
        <h3 class="text-sm font-semibold text-gray-800">{{ group.title }}</h3>
        <div class="grid sm:grid-cols-2 gap-4">
          <div v-for="field in group.fields" :key="field.key">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">{{ field.label }}</label>
            <div class="flex items-center gap-2">
              <input
                v-model="themeForm[field.key]"
                type="color"
                class="h-10 w-12 cursor-pointer rounded border border-gray-200 bg-white p-1"
              />
              <input
                v-model="themeForm[field.key]"
                type="text"
                dir="ltr"
                maxlength="7"
                class="input-field font-mono text-sm"
                placeholder="#000000"
              />
            </div>
            <p v-if="field.hint" class="mt-1 text-xs text-gray-500">{{ field.hint }}</p>
          </div>
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
        <div class="rounded-lg border p-4 space-y-3" :style="{ backgroundColor: themeForm.pageBg, borderColor: themeForm.border }">
          <p class="text-sm font-medium" :style="{ color: themeForm.text }">فروشگاه</p>
          <div class="rounded-lg border p-3" :style="{ backgroundColor: themeForm.header, borderColor: themeForm.border }">
            <span class="text-xs" :style="{ color: themeForm.textMuted }">هدر</span>
          </div>
          <div class="rounded-lg border p-3 flex flex-wrap gap-2" :style="{ backgroundColor: themeForm.surface, borderColor: themeForm.border }">
            <button type="button" class="rounded-lg px-3 py-1.5 text-sm" :style="{ backgroundColor: themeForm.primary, color: themeForm.onPrimary }">دکمه</button>
            <span class="text-sm" :style="{ color: themeForm.text }">متن</span>
          </div>
        </div>
        <div class="rounded-lg border p-4 space-y-3" :style="{ backgroundColor: themeForm.adminPageBg, borderColor: themeForm.border }">
          <p class="text-sm font-medium" :style="{ color: themeForm.text }">ادمین</p>
          <div class="rounded-lg border p-3" :style="{ backgroundColor: themeForm.surface, borderColor: themeForm.border }">
            <span class="text-sm" :style="{ color: themeForm.text }">کارت</span>
            <span class="text-xs mr-2" :style="{ color: themeForm.textMuted }">توضیح</span>
          </div>
        </div>
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          class="btn-primary px-5 py-2.5 disabled:opacity-60"
          :disabled="themeSaving"
          @click="saveThemeSettings"
        >
          {{ themeSaving ? 'در حال ذخیره…' : 'ذخیره تم رنگی' }}
        </button>
      </div>
    </div>

    <div
      v-if="showGuide && activeTab === 'maintenance'"
      class="card p-4 mb-6 text-sm text-gray-700 leading-7 bg-primary-50/40 border border-primary-100 max-w-3xl"
    >
      <p class="font-bold text-gray-800 mb-2">وقتی روشن باشد</p>
      <ul class="list-disc pr-5 space-y-1.5">
        <li>همه صفحات فروشگاه، پروفایل، سبد و ورود مشتری برای کاربر عادی بسته می‌شود و فقط صفحه تعمیر دیده می‌شود.</li>
        <li>ادمین، مسئول و پرسنل همچنان فروشگاه و پنل را می‌بینند و از همین‌جا خاموشش می‌کنند.</li>
        <li>ورود مدیران از مسیر <span dir="ltr" class="font-mono text-xs">/admin/login</span> باز می‌ماند.</li>
      </ul>
    </div>

    <div
      v-if="activeTab === 'maintenance' && maintenanceReady"
      class="bg-white rounded-xl border border-gray-100 p-6 space-y-6 max-w-2xl"
    >
      <div>
        <h2 class="text-lg font-semibold text-gray-900">حالت تعمیر / به‌روزرسانی</h2>
        <p class="text-sm text-gray-500 mt-1">
          صفحهٔ تمام‌صفحه با انیمیشن لباس، مثل صفحه ۴۰۴، برای بازدیدکننده‌ها.
        </p>
      </div>

      <label class="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-100 p-3 hover:bg-gray-50/80">
        <input v-model="maintenance.enabled" type="checkbox" class="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
        <span>
          <span class="block text-sm font-medium text-gray-900">فروشگاه در حال تعمیر باشد</span>
          <span class="block text-xs text-gray-500 mt-0.5 leading-relaxed">
            روشن = مشتریان صفحه تعمیر را می‌بینند. خاموش = فروشگاه عادی باز است.
          </span>
        </span>
      </label>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">متن صفحه</label>
        <textarea
          v-model="maintenance.message"
          rows="3"
          maxlength="280"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
        <NuxtLink to="/maintenance?preview=1" target="_blank" class="text-sm text-primary-700 hover:underline">
          پیش‌نمایش صفحه
        </NuxtLink>
        <button
          type="button"
          class="btn-primary px-5 py-2.5 disabled:opacity-60"
          :disabled="maintenanceSaving || maintenance.message.trim().length < 2"
          @click="saveMaintenance"
        >
          {{ maintenanceSaving ? 'در حال ذخیره…' : maintenance.enabled ? 'فعال کردن تعمیر' : 'ذخیره و باز کردن فروشگاه' }}
        </button>
      </div>
    </div>

    <div
      v-if="(activeTab === 'maintenance' && !maintenanceReady) || (activeTab === 'new-order-sms' && loading)"
      class="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400"
    >
      در حال بارگذاری…
    </div>

    <div
      v-else-if="activeTab === 'new-order-sms'"
      class="bg-white rounded-xl border border-gray-100 p-6 space-y-6 max-w-2xl"
    >
      <div>
        <h2 class="text-lg font-semibold text-gray-900">تنظیمات پیامک</h2>
        <p class="text-sm text-gray-500 mt-1">
          موجودی پنل ملی‌پیامک و نوتیف پیامکی سفارش جدید.
        </p>
      </div>

      <div
        class="rounded-xl border p-4"
        :class="
          smsCredit?.lowCredit || !smsCredit?.configured
            ? 'border-amber-200 bg-amber-50'
            : 'border-emerald-100 bg-emerald-50/70'
        "
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-gray-900">موجودی پنل پیامک</p>
            <p class="text-xs text-gray-500 mt-1">بر حسب ریال (ملی‌پیامک)</p>
          </div>
          <button
            type="button"
            class="text-xs text-primary-700 hover:underline disabled:opacity-50"
            :disabled="smsCreditLoading"
            @click="loadSmsCredit"
          >
            {{ smsCreditLoading ? 'در حال بروزرسانی…' : 'بروزرسانی موجودی' }}
          </button>
        </div>
        <p class="mt-3 text-2xl font-bold tabular-nums" :class="smsCredit?.lowCredit ? 'text-amber-800' : 'text-emerald-800'">
          <template v-if="smsCreditLoading && !smsCredit">…</template>
          <template v-else-if="smsCredit">{{ smsCredit.creditLabel }}</template>
          <template v-else>—</template>
        </p>
        <p
          v-if="smsCredit?.creditRials != null"
          class="mt-1 text-sm text-gray-600 tabular-nums"
        >
          معادل {{ Math.floor(smsCredit.creditRials / 10).toLocaleString('fa-IR') }} تومان
        </p>
        <p v-if="smsCredit?.warning" class="mt-2 text-sm leading-6 text-amber-900">
          {{ smsCredit.warning }}
        </p>
      </div>

      <div class="border-t border-gray-100 pt-4">
        <h3 class="text-base font-semibold text-gray-900">نوتیف پیامکی سفارش جدید</h3>
        <p class="text-sm text-gray-500 mt-1">
          وقتی مشتری سفارش ثبت می‌کند، پیامک به شماره‌های زیر می‌رود.
        </p>
      </div>

      <label class="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-100 p-3 hover:bg-gray-50/80">
        <input v-model="form.enabled" type="checkbox" class="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
        <span>
          <span class="block text-sm font-medium text-gray-900">ارسال پیامک فعال باشد</span>
          <span class="block text-xs text-gray-500 mt-0.5 leading-relaxed">
            خاموش = هیچ پیامک نوتیفی برای سفارش جدید نمی‌رود (نوتیف داخل پنل همچنان کار می‌کند).
          </span>
        </span>
      </label>

      <div :class="{ 'opacity-50 pointer-events-none': !form.enabled }">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <label class="block text-sm font-medium text-gray-700">شماره‌های گیرنده</label>
          <span class="text-xs text-gray-400">{{ phoneCount }} شماره</span>
        </div>
        <textarea
          v-model="form.phonesText"
          rows="4"
          dir="ltr"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono text-start focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="09121234567&#10;09129876543"
        />
        <p class="text-xs text-gray-500 mt-1.5 leading-relaxed">
          هر خط یک شماره موبایل ایران. می‌توانید با ویرگول هم جدا کنید. شماره‌های تکراری خودکار حذف می‌شوند.
        </p>
      </div>

      <label
        class="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-100 p-3 hover:bg-gray-50/80"
        :class="{ 'opacity-50': !form.enabled }"
      >
        <input
          v-model="form.includePanelStaff"
          type="checkbox"
          class="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          :disabled="!form.enabled"
        />
        <span>
          <span class="block text-sm font-medium text-gray-900">ارسال به همه پرسنل پنل</span>
          <span class="block text-xs text-gray-500 mt-0.5 leading-relaxed">
            علاوه بر لیست بالا، به همه کاربران فعال با نقش مدیر، مسئول یا پرسنل هم پیامک می‌رود.
            اگر پرسنل زیاد دارید، هزینه پیامک بیشتر می‌شود.
          </span>
        </span>
      </label>

      <div :class="{ 'opacity-50 pointer-events-none': !form.enabled }">
        <label class="block text-sm font-medium text-gray-700 mb-1.5">متن پیامک</label>
        <div class="flex flex-wrap gap-2 mb-2">
          <button
            type="button"
            class="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            @click="insertPlaceholder('{orderNumber}')"
          >
            + شماره سفارش
          </button>
          <button
            type="button"
            class="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            @click="insertPlaceholder('{customerName}')"
          >
            + نام مشتری
          </button>
        </div>
        <textarea
          v-model="form.messageTemplate"
          rows="4"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="سفارش جدید {orderNumber}&#10;مشتری: {customerName}"
        />
        <p class="text-xs text-gray-500 mt-1.5 leading-relaxed">
          متغیرها را عین همین بنویسید (با آکولاد). دکمه‌های بالا هم می‌توانند آن‌ها را به متن اضافه کنند.
        </p>
      </div>

      <div class="rounded-lg bg-gray-50 border border-gray-100 p-4" :class="{ 'opacity-50': !form.enabled }">
        <p class="text-xs font-medium text-gray-500 mb-2">پیش‌نمایش نمونه (با داده فرضی)</p>
        <pre class="text-sm text-gray-800 whitespace-pre-wrap font-sans">{{ previewText || '—' }}</pre>
      </div>

      <div
        v-if="form.enabled && !phoneCount && !form.includePanelStaff"
        class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
      >
        هنوز گیرنده‌ای ندارید. حداقل یک شماره وارد کنید یا «ارسال به همه پرسنل پنل» را روشن کنید.
      </div>

      <div class="rounded-lg border border-dashed border-gray-200 p-4 space-y-3">
        <div>
          <h3 class="text-sm font-semibold text-gray-900">ارسال پیامک تست</h3>
          <p class="text-xs text-gray-500 mt-1 leading-relaxed">
            قبل از ذخیره هم می‌توانید با متن فعلی فرم، یک پیامک آزمایشی بفرستید. پیشوند
            <span dir="ltr" class="font-mono">[تست]</span>
            به ابتدای پیام اضافه می‌شود.
          </p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">شماره گیرنده تست</label>
          <input
            v-model="testPhone"
            type="tel"
            dir="ltr"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono text-start focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="09121234567"
          />
        </div>
        <button
          type="button"
          class="btn-secondary text-sm disabled:opacity-60"
          :disabled="testing || !testPhone.trim()"
          @click="sendTestSms"
        >
          {{ testing ? 'در حال ارسال…' : 'ارسال پیامک تست' }}
        </button>
      </div>

      <div class="flex justify-end pt-2">
        <button
          type="button"
          class="btn-primary px-5 py-2.5 disabled:opacity-60"
          :disabled="saving"
          @click="saveSettings"
        >
          {{ saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات' }}
        </button>
      </div>
    </div>
    </div>
    </Transition>
  </div>
</template>
