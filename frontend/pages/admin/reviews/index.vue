<script setup lang="ts">
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
};

const reviews = ref<AdminReview[]>([]);
const page = ref(1);
const pages = ref(1);
const loading = ref(true);
const removingId = ref('');

async function load(next = page.value) {
  loading.value = true;
  try {
    const { data } = await api.get<{
      reviews: AdminReview[];
      pagination: { page: number; pages: number };
    }>(`/admin/reviews?page=${next}`);
    reviews.value = data.reviews;
    page.value = data.pagination.page;
    pages.value = data.pagination.pages;
  } finally {
    loading.value = false;
  }
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
    <h1 class="mb-4 text-lg font-bold text-gray-900">نظرات محصولات</h1>
    <p v-if="loading" class="text-sm text-gray-500">در حال بارگذاری</p>
    <p v-else-if="!reviews.length" class="text-sm text-gray-500">هنوز نظری ثبت نشده است.</p>
    <div v-else class="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-500">
          <tr>
            <th class="px-3 py-2 text-right font-medium">محصول</th>
            <th class="px-3 py-2 text-right font-medium">مشتری</th>
            <th class="px-3 py-2 text-right font-medium">امتیاز</th>
            <th class="px-3 py-2 text-right font-medium">نظر</th>
            <th class="px-3 py-2 text-right font-medium">تاریخ</th>
            <th class="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="review in reviews" :key="review.id" class="border-t border-gray-100">
            <td class="px-3 py-3">
              <NuxtLink :to="`/products/${review.productSlug}`" class="text-primary-700 hover:underline" target="_blank">
                {{ review.productName }}
              </NuxtLink>
            </td>
            <td class="px-3 py-3">
              <p>{{ review.authorName }}</p>
              <p class="text-xs text-gray-400" dir="ltr">{{ review.phone }}</p>
            </td>
            <td class="px-3 py-3">{{ toPersianDigits(review.rating) }}</td>
            <td class="max-w-xs px-3 py-3 text-gray-700">{{ review.body || '—' }}</td>
            <td class="px-3 py-3 whitespace-nowrap">{{ formatShortDate(review.createdAt) }}</td>
            <td class="px-3 py-3">
              <button
                type="button"
                class="text-red-600 disabled:opacity-50"
                :disabled="removingId === review.id"
                @click="remove(review)"
              >
                حذف
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="pages > 1" class="mt-4 flex gap-2">
      <button type="button" class="rounded border px-3 py-1 text-sm disabled:opacity-40" :disabled="page <= 1" @click="load(page - 1)">قبلی</button>
      <button type="button" class="rounded border px-3 py-1 text-sm disabled:opacity-40" :disabled="page >= pages" @click="load(page + 1)">بعدی</button>
    </div>
  </div>
</template>
