<script setup lang="ts">
import type { Pagination } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();
const { toPersianDigits, formatShortDate } = useFormat();

type AdminReview = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  authorName: string;
  phone: string;
  productName: string;
  productSlug: string;
  adminReply?: string | null;
  adminRepliedAt?: string | null;
};

const reviews = ref<AdminReview[]>([]);
const pagination = ref<Pagination | null>(null);
const page = ref(1);
const loading = ref(true);
const removingId = ref('');
const replyDrafts = ref<Record<string, string>>({});
const savingReplyId = ref('');
const openReplyId = ref('');

async function load(next = page.value) {
  loading.value = true;
  try {
    const { data } = await api.get<{
      reviews: AdminReview[];
      pagination: Pagination & { pages?: number };
    }>(`/admin/reviews?page=${next}`);
    reviews.value = data.reviews;
    const drafts: Record<string, string> = {};
    for (const review of data.reviews) {
      drafts[review.id] = review.adminReply || '';
    }
    replyDrafts.value = drafts;
    const totalPages = data.pagination.totalPages || data.pagination.pages || 1;
    pagination.value = {
      page: data.pagination.page,
      limit: data.pagination.limit || 20,
      total: data.pagination.total ?? data.reviews.length,
      totalPages,
    };
    page.value = data.pagination.page;
  } finally {
    loading.value = false;
  }
}

function goToPage(next: number) {
  page.value = next;
  openReplyId.value = '';
  void load(next);
}

function toggleReply(review: AdminReview) {
  openReplyId.value = openReplyId.value === review.id ? '' : review.id;
  if (!replyDrafts.value[review.id]) {
    replyDrafts.value[review.id] = review.adminReply || '';
  }
}

async function saveReply(review: AdminReview) {
  savingReplyId.value = review.id;
  try {
    const reply = (replyDrafts.value[review.id] || '').trim();
    const { data } = await api.put<{
      id: string;
      adminReply: string | null;
      adminRepliedAt: string | null;
    }>(`/admin/reviews/${review.id}/reply`, { reply });
    review.adminReply = data.adminReply;
    review.adminRepliedAt = data.adminRepliedAt;
    replyDrafts.value[review.id] = data.adminReply || '';
    toast.success(data.adminReply ? 'پاسخ ذخیره شد' : 'پاسخ حذف شد');
    if (!data.adminReply) openReplyId.value = '';
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'ذخیره پاسخ انجام نشد');
  } finally {
    savingReplyId.value = '';
  }
}

async function clearReply(review: AdminReview) {
  replyDrafts.value[review.id] = '';
  await saveReply(review);
}

async function remove(review: AdminReview) {
  removingId.value = review.id;
  try {
    await api.delete(`/admin/reviews/${review.id}`);
    toast.success('نظر حذف شد');
    await load(reviews.value.length === 1 && page.value > 1 ? page.value - 1 : page.value);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'حذف انجام نشد');
  } finally {
    removingId.value = '';
  }
}

onMounted(() => load(1));
useHead({ title: 'نظرات محصولات - پنل مدیریت' });
</script>

<template>
  <div>
    <h1 class="text-lg font-bold text-gray-900">نظرات محصولات</h1>
    <p class="mb-4 mt-1 max-w-2xl text-sm leading-6 text-gray-500">
      نظرهای مشتریان را ببینید، پاسخ بدهید یا در صورت نیاز حذف کنید. پاسخ شما زیر نظر در صفحهٔ محصول نمایش داده می‌شود.
    </p>
    <p v-if="loading" class="text-sm text-gray-500">در حال بارگذاری</p>
    <p v-else-if="!reviews.length" class="text-sm text-gray-500">هنوز نظری ثبت نشده است.</p>
    <div v-else class="data-table-wrap">
      <table class="data-table min-w-[900px]">
        <thead>
          <tr>
            <th>محصول</th>
            <th>مشتری</th>
            <th class="data-num">امتیاز</th>
            <th>نظر / پاسخ</th>
            <th>تاریخ</th>
            <th class="data-actions">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="review in reviews" :key="review.id">
            <td>
              <NuxtLink
                :to="`/products/${review.productSlug}`"
                class="font-semibold text-primary-700 hover:underline"
                target="_blank"
              >
                {{ review.productName }}
              </NuxtLink>
            </td>
            <td>
              <p class="font-medium text-slate-800">{{ review.authorName }}</p>
              <p class="text-xs text-slate-400 mt-0.5" dir="ltr">{{ review.phone }}</p>
            </td>
            <td class="data-num font-semibold">{{ toPersianDigits(review.rating) }}</td>
            <td class="max-w-md text-slate-600">
              <p>{{ review.body || '—' }}</p>
              <p
                v-if="review.adminReply"
                class="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-2.5 py-2 text-xs leading-5 text-emerald-900"
              >
                <span class="font-semibold">پاسخ فروشگاه:</span>
                {{ review.adminReply }}
              </p>
              <div v-if="openReplyId === review.id" class="mt-3 space-y-2">
                <textarea
                  v-model="replyDrafts[review.id]"
                  rows="3"
                  maxlength="1000"
                  class="input-field min-h-[84px] text-sm"
                  placeholder="پاسخ فروشگاه به این نظر…"
                />
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="admin-btn-secondary"
                    :disabled="savingReplyId === review.id"
                    @click="saveReply(review)"
                  >
                    {{ savingReplyId === review.id ? 'در حال ذخیره…' : 'ذخیره پاسخ' }}
                  </button>
                  <button
                    v-if="review.adminReply"
                    type="button"
                    class="admin-btn-danger"
                    :disabled="savingReplyId === review.id"
                    @click="clearReply(review)"
                  >
                    حذف پاسخ
                  </button>
                </div>
              </div>
            </td>
            <td class="whitespace-nowrap text-slate-500">{{ formatShortDate(review.createdAt) }}</td>
            <td class="data-actions">
              <div class="admin-actions">
                <button type="button" class="admin-btn-secondary" @click="toggleReply(review)">
                  {{ openReplyId === review.id ? 'بستن' : review.adminReply ? 'ویرایش پاسخ' : 'پاسخ' }}
                </button>
                <button
                  type="button"
                  class="admin-btn-danger"
                  :disabled="removingId === review.id"
                  @click="remove(review)"
                >
                  حذف
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPagination
      v-if="!loading && pagination && pagination.totalPages > 1"
      :pagination="pagination"
      compact
      @update:page="goToPage"
    />
  </div>
</template>
