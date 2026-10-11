<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';
import { PASSWORD_RULES, passwordPolicyError, passwordScore } from '~/utils/passwordPolicy';

const authStore = useAuthStore();
const route = useRoute();

type Step = 'authenticate' | 'signIn' | 'loginByPassword' | 'loginByOtp' | 'forgotPassword' | 'changePassword';

const step = ref<Step>('authenticate');
const phone = ref('');
const otp = ref('');
const password = ref('');
const confirmPassword = ref('');
const hasPassword = ref(false);
const resetToken = ref('');
const info = ref('');
const error = ref('');
const devCode = ref('');
const showPassword = ref(false);
const showConfirm = ref(false);
const resendLeft = ref(0);
let resendTimer: ReturnType<typeof setInterval> | null = null;

const redirect = computed(() => (route.query.redirect as string) || '');
const isCodeStep = computed(() => step.value === 'signIn' || step.value === 'loginByOtp' || step.value === 'forgotPassword');
const score = computed(() => passwordScore(password.value));
const strengthLabel = computed(() => {
  if (!password.value) return '';
  if (score.value <= 2) return 'ضعیف';
  if (score.value === 3) return 'معمولی';
  return 'عالی';
});
const resendClock = computed(() => {
  const minutes = String(Math.floor(resendLeft.value / 60)).padStart(2, '0');
  const seconds = String(resendLeft.value % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
});

function safeRedirectTarget(raw: string) {
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/profile';
  if (raw.startsWith('/admin')) return '/profile';
  return raw;
}

function clearResendTimer() {
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = null;
}

function startResendTimer() {
  clearResendTimer();
  resendLeft.value = 120;
  resendTimer = setInterval(() => {
    resendLeft.value -= 1;
    if (resendLeft.value <= 0) clearResendTimer();
  }, 1000);
}

onUnmounted(clearResendTimer);

async function afterLogin() {
  await authStore.fetchProfile().catch(() => undefined);
  await nextTick();
  await navigateTo(safeRedirectTarget(redirect.value || '/profile'), { replace: true });
}

function goBack() {
  error.value = '';
  otp.value = '';
  if (step.value === 'forgotPassword' || step.value === 'changePassword') {
    step.value = 'loginByPassword';
    return;
  }
  step.value = 'authenticate';
  info.value = '';
  devCode.value = '';
}

async function begin(intent?: 'otp' | 'forgot') {
  error.value = '';
  const result = await authStore.startAuth(phone.value, intent);
  info.value = result.message || '';
  devCode.value = result.devCode || '';
  hasPassword.value = result.hasPassword;
  otp.value = '';
  step.value = result.step;
  if (result.step !== 'loginByPassword') startResendTimer();
}

async function useOtpInstead() {
  try {
    await begin('otp');
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'خطا در ارسال کد';
  }
}

async function useForgot() {
  try {
    await begin('forgot');
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'خطا در ارسال کد';
  }
}
async function submitIdentifier() {
  try {
    await begin();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'شماره موبایل نامعتبر است';
  }
}

async function submitPasswordLogin() {
  error.value = '';
  try {
    await authStore.loginWithPassword(phone.value, password.value);
    await afterLogin();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'ورود ناموفق بود';
  }
}

async function submitCode() {
  if (authStore.loading || otp.value.length < 6) return;
  error.value = '';
  try {
    if (step.value === 'forgotPassword') {
      const result = await authStore.verifyForgotOtp(phone.value, otp.value);
      resetToken.value = result.resetToken;
      password.value = '';
      confirmPassword.value = '';
      step.value = 'changePassword';
      return;
    }
    await authStore.verifyOtp(phone.value, otp.value);
    await afterLogin();
  } catch (e: unknown) {
    otp.value = '';
    error.value = e instanceof Error ? e.message : 'کد تایید نامعتبر است';
  }
}

async function submitNewPassword() {
  error.value = '';
  const policyError = passwordPolicyError(password.value);
  if (policyError) {
    error.value = policyError;
    return;
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'تکرار رمز عبور مطابقت ندارد';
    return;
  }
  try {
    await authStore.resetPassword(resetToken.value, password.value);
    await afterLogin();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'تغییر رمز ناموفق بود';
  }
}

async function resend() {
  if (resendLeft.value > 0) return;
  try {
    await begin(step.value === 'forgotPassword' ? 'forgot' : 'otp');
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'خطا در ارسال کد';
  }
}

watch(otp, (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  if (digits !== value) {
    otp.value = digits;
    return;
  }
  if (digits.length === 6 && isCodeStep.value) submitCode();
});

useHead({
  title: `ورود | ثبت‌نام - ${SITE_NAME}`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});
definePageMeta({ layout: false });
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-gray-50">
    <div class="w-full max-w-sm">
      <div class="flex justify-center mb-8">
        <AppLogo size="lg" />
      </div>

      <div class="card p-6">
        <button
          v-if="step !== 'authenticate'"
          type="button"
          class="mb-4 inline-flex items-center gap-1 text-sm text-gray-500"
          @click="goBack"
        >
          <AppIcon name="lucide:arrow-right" size="sm" />
          بازگشت
        </button>

        <form v-if="step === 'authenticate'" class="space-y-4" @submit.prevent="submitIdentifier">
          <h1 class="text-base font-semibold text-gray-900">ورود | ثبت‌نام</h1>
          <p class="text-sm text-gray-600 leading-6">
            سلام!
            <br>
            لطفا شماره موبایل یا نام کاربری خود را وارد کنید.
          </p>
          <input
            v-model="phone"
            name="username"
            required
            class="input-field"
            placeholder="شماره موبایل، نام کاربری یا ایمیل"
            dir="ltr"
            autocomplete="username"
          />
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">
            {{ authStore.loading ? '...' : 'تایید' }}
          </button>
        </form>

        <form v-else-if="step === 'signIn'" class="space-y-4" @submit.prevent="submitCode">
          <h1 class="text-base font-semibold text-gray-900">خوش آمدید</h1>
          <p class="text-xs text-gray-500">{{ info }}</p>
          <p v-if="devCode" class="text-xs text-amber-800 bg-amber-50 rounded-lg p-2">
            کد توسعه: <b dir="ltr">{{ devCode }}</b>
          </p>
          <input
            v-model="otp"
            inputmode="numeric"
            maxlength="6"
            autocomplete="one-time-code"
            class="input-field text-center tracking-[0.4em]"
            dir="ltr"
          />
          <button type="button" class="text-xs text-gray-500 disabled:opacity-50" :disabled="resendLeft > 0 || authStore.loading" @click="resend">
            <template v-if="resendLeft > 0">{{ resendClock }} تا ارسال مجدد</template>
            <template v-else>ارسال مجدد</template>
          </button>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">تایید</button>
          <p class="text-xs text-gray-500 leading-6">
            عضویت شما به معنای پذیرش
            <NuxtLink to="/pages/terms" class="text-primary-700 font-medium">شرایط و قوانین</NuxtLink>
            است.
          </p>
        </form>

        <form v-else-if="step === 'loginByPassword'" class="space-y-4" @submit.prevent="submitPasswordLogin">
          <h1 class="text-base font-semibold text-gray-900">رمز عبور را وارد کنید</h1>
          <div class="relative">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              class="input-field pl-10"
              dir="ltr"
              autocomplete="current-password"
            />
            <button type="button" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" @click="showPassword = !showPassword">
              <AppIcon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" size="sm" />
            </button>
          </div>
          <div class="flex items-center justify-between text-xs">
            <button type="button" class="text-primary-700" @click="useOtpInstead">ورود با رمز یک‌بارمصرف</button>
            <button type="button" class="text-gray-500" @click="useForgot">فراموشی رمز عبور</button>
          </div>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">ورود</button>
        </form>

        <form v-else-if="step === 'loginByOtp' || step === 'forgotPassword'" class="space-y-4" @submit.prevent="submitCode">
          <h1 class="text-base font-semibold text-gray-900">کد تایید را وارد کنید</h1>
          <p class="text-xs text-gray-500">{{ info }}</p>
          <p v-if="devCode" class="text-xs text-amber-800 bg-amber-50 rounded-lg p-2">
            کد توسعه: <b dir="ltr">{{ devCode }}</b>
          </p>
          <input
            v-model="otp"
            inputmode="numeric"
            maxlength="6"
            autocomplete="one-time-code"
            class="input-field text-center tracking-[0.4em]"
            dir="ltr"
          />
          <div class="flex items-center justify-between text-xs">
            <button
              v-if="step === 'loginByOtp' && hasPassword"
              type="button"
              class="text-primary-700"
              @click="step = 'loginByPassword'"
            >
              ورود با رمز عبور
            </button>
            <button type="button" class="text-gray-500 disabled:opacity-50" :disabled="resendLeft > 0 || authStore.loading" @click="resend">
              <template v-if="resendLeft > 0">{{ resendClock }} تا ارسال مجدد</template>
              <template v-else>ارسال مجدد</template>
            </button>
          </div>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">تایید</button>
        </form>

        <form v-else class="space-y-4" @submit.prevent="submitNewPassword">
          <h1 class="text-base font-semibold text-gray-900">تغییر رمز عبور</h1>
          <p class="text-sm text-gray-600">رمز عبور باید حداقل ۸ حرفی باشد.</p>
          <div>
            <label class="field-label">رمز عبور جدید</label>
            <div class="relative">
              <input v-model="password" :type="showPassword ? 'text' : 'password'" class="input-field pl-10" dir="ltr" autocomplete="new-password" />
              <button type="button" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" @click="showPassword = !showPassword">
                <AppIcon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" size="sm" />
              </button>
            </div>
            <p
              v-if="password"
              class="text-xs mt-2"
              :class="score <= 2 ? 'text-red-500' : score === 3 ? 'text-amber-600' : 'text-green-600'"
            >
              {{ strengthLabel }}
            </p>
            <div class="mt-2 flex gap-1">
              <span class="h-1 flex-1 rounded" :class="password && score > 0 ? (score <= 2 ? 'bg-red-400' : score === 3 ? 'bg-amber-400' : 'bg-green-500') : 'bg-gray-200'" />
              <span class="h-1 flex-1 rounded" :class="score >= 3 ? (score === 3 ? 'bg-amber-400' : 'bg-green-500') : 'bg-gray-200'" />
              <span class="h-1 flex-1 rounded" :class="score >= 4 ? 'bg-green-500' : 'bg-gray-200'" />
            </div>
            <ul class="mt-3 space-y-1 text-xs text-gray-500">
              <li v-for="rule in PASSWORD_RULES" :key="rule.key" :class="rule.test(password) ? 'text-green-700' : ''">
                {{ rule.label }}
              </li>
            </ul>
          </div>
          <div>
            <label class="field-label">تکرار رمز عبور</label>
            <div class="relative">
              <input v-model="confirmPassword" :type="showConfirm ? 'text' : 'password'" class="input-field pl-10" dir="ltr" autocomplete="new-password" />
              <button type="button" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" @click="showConfirm = !showConfirm">
                <AppIcon :name="showConfirm ? 'lucide:eye-off' : 'lucide:eye'" size="sm" />
              </button>
            </div>
          </div>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <button type="submit" class="btn-primary w-full" :disabled="authStore.loading">تایید</button>
        </form>
      </div>

      <p class="text-center text-sm text-gray-400 mt-4 space-y-1">
        <NuxtLink to="/" class="block hover:text-primary-600">بازگشت به فروشگاه</NuxtLink>
        <NuxtLink to="/admin/login" class="block hover:text-primary-600">ورود مدیران</NuxtLink>
      </p>
    </div>
  </div>
</template>
