<script setup lang="ts">
import type { AddressFieldErrors } from '~/composables/useAddressFields';
import { IRAN_PROVINCES } from '~/constants/iranLocations';

const props = defineProps<{
  errors?: AddressFieldErrors;
  streetLabel?: string;
  cityOptions?: string[];
}>();

const street = defineModel<string>('street', { default: '' });
const plaque = defineModel<string>('plaque', { default: '' });
const unit = defineModel<string>('unit', { default: '' });
const province = defineModel<string>('province', { default: 'تهران' });
const city = defineModel<string>('city', { default: 'تهران' });
const postalCode = defineModel<string>('postalCode', { default: '' });

const provinceOptions = IRAN_PROVINCES.map((item) => ({ value: item.name, label: item.name }));
const citySelectOptions = computed(() =>
  (props.cityOptions ?? []).map((name) => ({ value: name, label: name }))
);
</script>

<template>
  <div class="space-y-5">
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="field-label">استان</label>
        <AppSelect v-model="province" :options="provinceOptions" :invalid="Boolean(errors?.province)" />
        <AppFormError :message="errors?.province" />
      </div>
      <div>
        <label class="field-label">شهر</label>
        <AppSelect v-model="city" :options="citySelectOptions" :invalid="Boolean(errors?.city)" />
        <AppFormError :message="errors?.city" />
      </div>
    </div>

    <div>
      <label class="field-label">{{ streetLabel || 'خیابان و محله' }}</label>
      <textarea
        v-model="street"
        required
        rows="2"
        class="input-field resize-none"
        :class="{ 'input-invalid': errors?.street }"
        placeholder="محله، خیابان"
      />
      <AppFormError :message="errors?.street" />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="field-label">پلاک</label>
        <input
          v-model="plaque"
          type="text"
          required
          inputmode="numeric"
          class="input-field"
          :class="{ 'input-invalid': errors?.plaque }"
          placeholder="۱۲"
          dir="ltr"
        />
        <AppFormError :message="errors?.plaque" />
      </div>
      <div>
        <label class="field-label">واحد</label>
        <input
          v-model="unit"
          type="text"
          required
          class="input-field"
          :class="{ 'input-invalid': errors?.unit }"
          placeholder="۳"
          dir="ltr"
        />
        <AppFormError :message="errors?.unit" />
      </div>
    </div>

    <div>
      <label class="field-label">کدپستی</label>
      <input
        v-model="postalCode"
        type="text"
        required
        inputmode="numeric"
        maxlength="10"
        class="input-field"
        :class="{ 'input-invalid': errors?.postalCode }"
        placeholder="۱۰ رقم"
        dir="ltr"
      />
      <AppFormError :message="errors?.postalCode" />
    </div>
  </div>
</template>
