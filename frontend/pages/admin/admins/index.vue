<script setup lang="ts">
import type { User, UserRole } from '~/types';
import { ROLE_LABELS } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();
const authStore = useAuthStore();
const { isFullAdmin } = useAdminAccess();
const { formatDate } = useFormat();

type PanelUser = User & {
  createdAt: string;
  updatedAt?: string;
  isActive?: boolean;
};

const users = ref<PanelUser[]>([]);
const loading = ref(true);
const search = ref('');
const showForm = ref(false);
const editingId = ref<string | null>(null);
const formError = ref('');
const saving = ref(false);

const form = reactive({
  phone: '',
  firstName: '',
  lastName: '',
  password: '',
  role: 'STAFF' as 'ADMIN' | 'SUPERVISOR' | 'STAFF',
  isActive: true,
});

const roleOptions: { value: 'ADMIN' | 'SUPERVISOR' | 'STAFF'; label: string }[] = [
  { value: 'ADMIN', label: 'مدیر' },
  { value: 'SUPERVISOR', label: 'مسئول' },
  { value: 'STAFF', label: 'پرسنل' },
];

const roleBadgeClass: Record<string, string> = {
  ADMIN: 'admin-badge bg-violet-50 text-violet-700',
  SUPERVISOR: 'admin-badge bg-sky-50 text-sky-700',
  STAFF: 'admin-badge bg-amber-50 text-amber-800',
};

onMounted(async () => {
  if (!isFullAdmin.value) {
    await navigateTo('/admin');
    return;
  }
  await loadUsers();
});

async function loadUsers() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (search.value.trim()) params.set('search', search.value.trim());
    const { data } = await api.get<{ users: PanelUser[] }>(
      `/admin/admins${params.toString() ? `?${params}` : ''}`
    );
    users.value = data.users || [];
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'بارگذاری لیست انجام نشد');
    users.value = [];
  } finally {
    loading.value = false;
  }
}

function displayName(user: PanelUser) {
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—';
}

function openCreate() {
  editingId.value = null;
  formError.value = '';
  Object.assign(form, {
    phone: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'STAFF',
    isActive: true,
  });
  showForm.value = true;
}

function openEdit(user: PanelUser) {
  editingId.value = user.id;
  formError.value = '';
  Object.assign(form, {
    phone: user.phone,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    password: '',
    role: (['ADMIN', 'SUPERVISOR', 'STAFF'].includes(user.role)
      ? user.role
      : 'STAFF') as 'ADMIN' | 'SUPERVISOR' | 'STAFF',
    isActive: user.isActive !== false,
  });
  showForm.value = true;
}

async function save() {
  formError.value = '';
  saving.value = true;
  try {
    if (editingId.value) {
      const payload: Record<string, unknown> = {
        phone: form.phone.trim(),
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        role: form.role,
        accessRoleId: null,
        isActive: form.isActive,
      };
      if (form.password.trim()) payload.password = form.password.trim();
      await api.put(`/admin/admins/${editingId.value}`, payload);
      toast.success('اطلاعات به‌روزرسانی شد');
    } else {
      await api.post('/admin/admins', {
        phone: form.phone.trim(),
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        password: form.password.trim() || undefined,
        role: form.role,
      });
      toast.success('مدیر / پرسنل اضافه شد');
    }
    showForm.value = false;
    await loadUsers();
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'خطا در ذخیره';
    toast.error(formError.value);
  } finally {
    saving.value = false;
  }
}

async function removeUser(user: PanelUser) {
  if (user.id === authStore.user?.id) {
    toast.error('نمی‌توانید خودتان را حذف کنید');
    return;
  }
  if (
    !confirm(
      `دسترسی پنل «${displayName(user)}» حذف شود؟\n(به مشتری تبدیل می‌شود و دیگر وارد پنل نمی‌شود)`
    )
  ) {
    return;
  }
  try {
    await api.delete(`/admin/admins/${user.id}`);
    toast.success('دسترسی پنل حذف شد');
    await loadUsers();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'حذف انجام نشد');
  }
}

useHead({ title: 'مدیران پنل - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-800">مدیران و پرسنل پنل</h1>
        <p class="mt-1 text-sm leading-6 text-gray-500">
          فقط مدیر اصلی می‌تواند ادمین، مسئول و پرسنل را اضافه، ویرایش یا حذف کند.
        </p>
      </div>
      <button type="button" class="btn-primary text-sm" @click="openCreate">+ افزودن مدیر / پرسنل</button>
    </div>

    <div class="mb-4 flex flex-col gap-3 md:flex-row">
      <input
        v-model="search"
        type="search"
        class="input-field md:max-w-xs"
        placeholder="جستجو نام یا موبایل..."
        @keyup.enter="loadUsers"
      />
      <button type="button" class="btn-secondary text-sm" @click="loadUsers">جستجو</button>
    </div>

    <LoadingSpinner :show="loading" />

    <EmptyState
      v-if="!loading && !users.length"
      message="هنوز مدیر یا پرسنلی ثبت نشده"
      class="py-10"
    />

    <div v-else-if="!loading" class="data-table-wrap">
      <table class="data-table min-w-[820px]">
        <thead>
          <tr>
            <th>نام</th>
            <th>موبایل</th>
            <th>نقش</th>
            <th>وضعیت</th>
            <th>عضویت</th>
            <th class="data-actions">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td class="font-semibold text-slate-800">
              {{ displayName(user) }}
              <span
                v-if="user.id === authStore.user?.id"
                class="ms-1 text-[11px] font-normal text-primary-600"
              >
                (شما)
              </span>
            </td>
            <td>
              <span dir="ltr" class="tabular-nums text-slate-600">{{ user.phone }}</span>
            </td>
            <td>
              <span :class="roleBadgeClass[user.role] || 'admin-badge'">
                {{ user.accessRole?.name || ROLE_LABELS[user.role as UserRole] || user.role }}
              </span>
            </td>
            <td>
              <span :class="user.isActive !== false ? 'admin-badge-success' : 'admin-badge-danger'">
                {{ user.isActive !== false ? 'فعال' : 'غیرفعال' }}
              </span>
            </td>
            <td class="whitespace-nowrap text-slate-500">{{ formatDate(user.createdAt) }}</td>
            <td class="data-actions">
              <div class="admin-actions">
                <button type="button" class="admin-btn-secondary" @click="openEdit(user)">ویرایش</button>
                <button
                  type="button"
                  class="admin-btn-warn"
                  :disabled="user.id === authStore.user?.id"
                  @click="removeUser(user)"
                >
                  حذف از پنل
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showForm = false"
    >
      <form class="w-full max-w-md space-y-4 rounded-2xl bg-white p-6" @submit.prevent="save">
        <h2 class="text-lg font-bold">
          {{ editingId ? 'ویرایش مدیر / پرسنل' : 'افزودن مدیر / پرسنل' }}
        </h2>
        <AppAlertBanner :message="formError" />

        <div>
          <label class="mb-1 block text-sm font-medium">موبایل</label>
          <input v-model="form.phone" required class="input-field" dir="ltr" placeholder="0912..." />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm font-medium">نام</label>
            <input v-model="form.firstName" class="input-field" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">نام خانوادگی</label>
            <input v-model="form.lastName" class="input-field" />
          </div>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium">نقش</label>
          <select v-model="form.role" class="input-field">
            <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium">
            رمز ورود
            <span class="font-normal text-gray-400">
              {{ editingId ? '(اختیاری — خالی = بدون تغییر)' : '(اختیاری)' }}
            </span>
          </label>
          <input
            v-model="form.password"
            type="password"
            class="input-field"
            :minlength="editingId && !form.password ? undefined : 6"
            autocomplete="new-password"
          />
        </div>

        <label v-if="editingId" class="flex items-center gap-2 text-sm">
          <input v-model="form.isActive" type="checkbox" class="rounded border-gray-300" />
          حساب فعال باشد
        </label>

        <div class="flex justify-end gap-2 pt-1">
          <button type="button" class="btn-secondary text-sm" @click="showForm = false">انصراف</button>
          <button type="submit" class="btn-primary text-sm" :disabled="saving">
            {{ saving ? '...' : 'ذخیره' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
