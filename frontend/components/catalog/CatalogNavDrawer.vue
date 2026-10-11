<script setup lang="ts">
import type { Category } from '~/types';
import { CONTACT_PHONE, SITE_NAME, STORE_HOURS } from '~/constants/site';
import { navCategoryLabel } from '~/constants/categoryNav';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const api = useApi();
const { toPersianDigits } = useFormat();

const { data: categories, refresh } = await useAsyncData('catalog-nav-categories', async () => {
  try {
    const { data } = await api.get<Category[]>('/categories?lite=1');
    return data ?? [];
  } catch {
    return [];
  }
});

const { roots, childrenOf, defaultRootSlug } = useCategoryNavTree(computed(() => categories.value));

const activeRootSlug = ref<string | null>(null);
const expandedSlug = ref<string | null>(null);
const closeBtnRef = ref<HTMLButtonElement | null>(null);

const activeRoot = computed(() => roots.value.find((root) => root.slug === activeRootSlug.value) ?? null);

const subcategories = computed(() => {
  if (!activeRootSlug.value) return [];
  return childrenOf(activeRootSlug.value);
});

const shortcuts = [
  { to: '/search?sort=newest', label: 'جدیدترین', icon: 'lucide:sparkles' },
  { to: '/search?discounted=1', label: 'پیشنهاد ویژه', icon: 'lucide:tag' },
  { to: '/profile/favorites', label: 'علاقه‌مندی‌ها', icon: 'lucide:heart' },
];

const importantPages = [
  { to: '/categories', label: 'همه کالکشن‌ها', icon: 'lucide:layout-grid' },
  { to: '/cart', label: 'سبد خرید', icon: 'lucide:shopping-bag' },
  { to: '/profile/orders', label: 'پیگیری سفارش', icon: 'lucide:package-search' },
  { to: '/pages/about', label: 'درباره ما', icon: 'lucide:info' },
  { to: '/contact', label: 'تماس با ما', icon: 'lucide:phone' },
  { to: '/pages/terms', label: 'قوانین', icon: 'lucide:scroll-text' },
];

function syncExpanded() {
  const firstWithKids = subcategories.value.find((sub) => childrenOf(sub.slug).length);
  expandedSlug.value = firstWithKids?.slug ?? subcategories.value[0]?.slug ?? null;
}

watch(
  () => props.open,
  async (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (!isOpen) return;
    void refresh();
    activeRootSlug.value = defaultRootSlug();
    await nextTick();
    syncExpanded();
    closeBtnRef.value?.focus();
  },
);

watch(roots, (list) => {
  if (!activeRootSlug.value && list.length) {
    activeRootSlug.value = list[0].slug;
  }
});

watch(activeRootSlug, () => {
  if (props.open) syncExpanded();
});

function pickRoot(slug: string) {
  activeRootSlug.value = slug;
}

function toggleExpand(slug: string) {
  expandedSlug.value = expandedSlug.value === slug ? null : slug;
}

function go(path: string) {
  emit('close');
  navigateTo(path);
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    e.preventDefault();
    emit('close');
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <Transition name="catalog-nav-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[80] bg-[#1a0f12]/55 backdrop-blur-[2px]"
        aria-hidden="true"
        @click="onBackdropClick"
      />
    </Transition>

    <Transition name="catalog-nav-slide">
      <aside
        v-if="open"
        class="catalog-nav-panel fixed inset-y-0 z-[81] flex w-full max-w-[min(100%,26rem)] flex-col overflow-hidden bg-[#fbfaf9] shadow-[-12px_0_40px_rgba(26,15,18,0.18)] md:max-w-[42rem]"
        role="dialog"
        aria-modal="true"
        aria-label="منوی دسته‌بندی"
      >
        <header class="catalog-nav-header relative shrink-0 px-4 pb-4 pt-4 md:px-5">
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3">
              <AppLogo size="sm" :link="false" />
              <div class="min-w-0">
                <p class="text-[11px] font-medium tracking-[0.18em] text-primary-700/80">
                  {{ SITE_NAME }}
                </p>
                <h2 class="truncate text-lg font-semibold tracking-tight text-neutral-950">
                  کالکشن‌ها
                </h2>
              </div>
            </div>
            <button
              ref="closeBtnRef"
              type="button"
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200/80 bg-white text-neutral-800 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
              aria-label="بستن منو"
              @click="emit('close')"
            >
              <AppIcon name="lucide:x" size="md" />
            </button>
          </div>

          <div class="mt-4 flex items-center gap-x-3 gap-y-2 overflow-x-auto scrollbar-hide">
            <template v-for="(item, i) in shortcuts" :key="item.to">
              <span v-if="i > 0" class="h-3 w-px shrink-0 bg-neutral-300" aria-hidden="true" />
              <button
                type="button"
                class="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-neutral-700 transition-colors hover:text-primary-800"
                @click="go(item.to)"
              >
                <AppIcon :name="item.icon" size="xs" />
                {{ item.label }}
              </button>
            </template>
          </div>
        </header>

        <div class="grid min-h-0 flex-1 grid-cols-[6.75rem_minmax(0,1fr)] md:grid-cols-[9.5rem_minmax(0,1fr)]">
          <nav
            class="catalog-nav-rail overflow-y-auto border-e border-neutral-200/70 py-2"
            aria-label="دسته‌های اصلی"
          >
            <ul class="flex flex-col gap-0.5 px-1.5">
              <li v-for="root in roots" :key="root.id">
                <button
                  type="button"
                  :class="[
                    'catalog-nav-root relative w-full rounded-lg px-2.5 py-3 text-start text-[13px] transition-all md:px-3 md:text-sm',
                    activeRootSlug === root.slug
                      ? 'bg-white font-semibold text-primary-800 shadow-[0_1px_0_rgba(0,0,0,0.04)]'
                      : 'font-medium text-neutral-600 hover:bg-white/60 hover:text-neutral-900',
                  ]"
                  :aria-current="activeRootSlug === root.slug ? 'true' : undefined"
                  @click="pickRoot(root.slug)"
                >
                  <span
                    v-if="activeRootSlug === root.slug"
                    class="absolute inset-y-2 start-0 w-0.5 rounded-full bg-primary-700"
                    aria-hidden="true"
                  />
                  {{ navCategoryLabel(root) }}
                </button>
              </li>
              <li class="mt-1 border-t border-neutral-200/80 pt-1">
                <button
                  type="button"
                  class="w-full rounded-lg px-2.5 py-3 text-start text-[13px] font-medium text-primary-700 transition-colors hover:bg-white/60 md:px-3 md:text-sm"
                  @click="go('/search?discounted=1')"
                >
                  پیشنهاد ویژه
                </button>
              </li>
            </ul>
          </nav>

          <div class="overflow-y-auto bg-white px-3 py-3 md:px-5">
            <button
              v-if="activeRoot"
              type="button"
              class="group mb-4 flex w-full items-center justify-between gap-3 border-b border-neutral-100 pb-3 text-start"
              @click="go(`/categories/${activeRoot.slug}`)"
            >
              <span>
                <span class="block text-[11px] tracking-wide text-neutral-400">مرور همه</span>
                <span class="mt-0.5 block text-[15px] font-semibold text-neutral-950 group-hover:text-primary-800">
                  {{ navCategoryLabel(activeRoot) }}
                </span>
              </span>
              <span
                class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-50 text-neutral-700 transition-colors group-hover:bg-primary-50 group-hover:text-primary-800"
              >
                <AppIcon name="lucide:arrow-left" size="sm" />
              </span>
            </button>

            <div v-if="subcategories.length" class="space-y-1">
              <section
                v-for="(sub, index) in subcategories"
                :key="sub.id"
                class="catalog-nav-section"
                :style="{ '--enter-delay': `${Math.min(index, 8) * 28}ms` }"
              >
                <div class="flex items-stretch gap-1">
                  <button
                    type="button"
                    class="min-w-0 flex-1 rounded-lg px-2 py-2.5 text-start text-[14px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 hover:text-primary-800"
                    @click="go(`/categories/${sub.slug}`)"
                  >
                    {{ navCategoryLabel(sub) }}
                  </button>
                  <button
                    v-if="childrenOf(sub.slug).length"
                    type="button"
                    class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                    :aria-expanded="expandedSlug === sub.slug"
                    :aria-label="expandedSlug === sub.slug ? 'بستن زیرمجموعه‌ها' : 'باز کردن زیرمجموعه‌ها'"
                    @click="toggleExpand(sub.slug)"
                  >
                    <AppIcon
                      name="lucide:chevron-down"
                      size="sm"
                      class="transition-transform duration-200"
                      :class="expandedSlug === sub.slug ? 'rotate-180' : ''"
                    />
                  </button>
                </div>

                <ul
                  v-if="childrenOf(sub.slug).length && expandedSlug === sub.slug"
                  :key="`kids-${sub.slug}`"
                  class="mb-1 ms-2 space-y-0.5 border-s border-primary-200 ps-3"
                >
                  <li v-for="child in childrenOf(sub.slug)" :key="child.id">
                    <button
                      type="button"
                      class="w-full rounded-md px-2 py-2 text-start text-[13px] text-neutral-600 transition-colors hover:bg-primary-50/60 hover:text-primary-900"
                      @click="go(`/categories/${child.slug}`)"
                    >
                      {{ navCategoryLabel(child) }}
                    </button>
                  </li>
                </ul>
              </section>
            </div>
            <p v-else class="py-10 text-center text-sm text-neutral-500">
              زیردسته‌ای برای این بخش ثبت نشده است.
            </p>
          </div>
        </div>

        <footer class="shrink-0 border-t border-neutral-200/80 bg-white px-3 py-3 md:px-4">
          <nav aria-label="صفحات مهم">
            <ul class="grid grid-cols-3 gap-1 sm:grid-cols-6">
              <li v-for="page in importantPages" :key="page.to">
                <button
                  type="button"
                  class="flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-primary-800"
                  @click="go(page.to)"
                >
                  <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-50 text-neutral-800">
                    <AppIcon :name="page.icon" size="sm" />
                  </span>
                  <span class="text-[10px] font-medium leading-tight">{{ page.label }}</span>
                </button>
              </li>
            </ul>
          </nav>
          <a
            :href="`tel:${CONTACT_PHONE}`"
            class="mt-2 flex items-center justify-between gap-2 rounded-xl bg-[#f6f1f2] px-3 py-2.5 text-start transition-colors hover:bg-primary-50"
          >
            <span class="min-w-0">
              <span class="block text-[10px] text-neutral-500">پشتیبانی</span>
              <span class="block truncate text-sm font-semibold text-primary-900" dir="ltr">
                {{ toPersianDigits(CONTACT_PHONE) }}
              </span>
            </span>
            <span class="hidden text-[10px] leading-4 text-neutral-500 sm:block">
              {{ STORE_HOURS }}
            </span>
          </a>
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.catalog-nav-header {
  background:
    radial-gradient(120% 80% at 100% 0%, rgba(101, 42, 59, 0.08), transparent 55%),
    linear-gradient(180deg, #fff 0%, #fbfaf9 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.catalog-nav-rail {
  background:
    linear-gradient(180deg, rgba(101, 42, 59, 0.04), transparent 28%),
    #f3eeef;
}

.catalog-nav-section {
  animation: catalog-nav-rise 0.35s ease both;
  animation-delay: var(--enter-delay, 0ms);
}

@keyframes catalog-nav-rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.catalog-nav-fade-enter-active,
.catalog-nav-fade-leave-active {
  transition: opacity 0.22s ease;
}
.catalog-nav-fade-enter-from,
.catalog-nav-fade-leave-to {
  opacity: 0;
}

.catalog-nav-slide-enter-active,
.catalog-nav-slide-leave-active {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}
.catalog-nav-panel {
  right: 0;
  left: auto;
}

.catalog-nav-slide-enter-from,
.catalog-nav-slide-leave-to {
  transform: translate3d(100%, 0, 0);
}

@media (prefers-reduced-motion: reduce) {
  .catalog-nav-section,
  .catalog-nav-slide-enter-active,
  .catalog-nav-slide-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
