import { citiesOfProvince, DEFAULT_CITY, DEFAULT_PROVINCE } from '~/constants/iranLocations';

export interface AddressFieldErrors {
  street?: string;
  plaque?: string;
  unit?: string;
  province?: string;
  city?: string;
  postalCode?: string;
}

export function composeAddress(input: {
  province: string;
  city: string;
  street: string;
  plaque: string;
  unit: string;
  postalCode: string;
}): string {
  return [
    input.province.trim() ? `استان ${input.province.trim()}` : '',
    input.city.trim() ? `شهر ${input.city.trim()}` : '',
    input.street.trim(),
    input.plaque.trim() ? `پلاک ${input.plaque.trim()}` : '',
    input.unit.trim() ? `واحد ${input.unit.trim()}` : '',
    input.postalCode.trim() ? `کدپستی ${input.postalCode.trim()}` : '',
  ]
    .filter(Boolean)
    .join('، ');
}

export function useAddressFields() {
  const street = ref('');
  const plaque = ref('');
  const unit = ref('');
  const province = ref(DEFAULT_PROVINCE);
  const city = ref(DEFAULT_CITY);
  const postalCode = ref('');
  const errors = reactive<AddressFieldErrors>({});

  const cityOptions = computed(() => citiesOfProvince(province.value));

  watch(province, (value) => {
    const cities = citiesOfProvince(value);
    if (!cities.includes(city.value)) {
      city.value = cities[0] || '';
    }
  });

  function clearErrors() {
    errors.street = undefined;
    errors.plaque = undefined;
    errors.unit = undefined;
    errors.province = undefined;
    errors.city = undefined;
    errors.postalCode = undefined;
  }

  function reset() {
    street.value = '';
    plaque.value = '';
    unit.value = '';
    province.value = DEFAULT_PROVINCE;
    city.value = DEFAULT_CITY;
    postalCode.value = '';
    clearErrors();
  }

  function loadFromAddress(address: {
    address: string;
    plaque?: string | null;
    unit?: string | null;
    province?: string | null;
    city?: string | null;
    postalCode?: string | null;
  }) {
    plaque.value = address.plaque?.trim() || '';
    unit.value = address.unit?.trim() || '';
    province.value = address.province?.trim() || DEFAULT_PROVINCE;
    const cities = citiesOfProvince(province.value);
    const savedCity = address.city?.trim() || '';
    city.value = cities.includes(savedCity) ? savedCity : cities[0] || DEFAULT_CITY;
    postalCode.value = address.postalCode?.trim() || '';

    let streetText = address.address.trim();
    if (plaque.value && unit.value) {
      const suffix = `، پلاک ${plaque.value}، واحد ${unit.value}`;
      if (streetText.endsWith(suffix)) {
        streetText = streetText.slice(0, -suffix.length).trim();
      }
    }
    street.value = streetText;
    clearErrors();
  }

  function validate(): boolean {
    clearErrors();
    let valid = true;
    const cities = citiesOfProvince(province.value);

    if (!province.value.trim() || !cities.length) {
      errors.province = 'استان را انتخاب کنید';
      valid = false;
    }
    if (!city.value.trim() || !cities.includes(city.value)) {
      errors.city = 'شهر را انتخاب کنید';
      valid = false;
    }
    if (street.value.trim().length < 5) {
      errors.street = 'خیابان و محله را کامل وارد کنید';
      valid = false;
    }
    if (!plaque.value.trim()) {
      errors.plaque = 'پلاک را وارد کنید';
      valid = false;
    }
    if (!unit.value.trim()) {
      errors.unit = 'واحد را وارد کنید';
      valid = false;
    }
    if (!/^\d{10}$/.test(postalCode.value.trim())) {
      errors.postalCode = 'کدپستی باید ۱۰ رقم باشد';
      valid = false;
    }

    return valid;
  }

  function payload(extra?: { title?: string; isDefault?: boolean }) {
    const streetVal = street.value.trim();
    const plaqueVal = plaque.value.trim();
    const unitVal = unit.value.trim();
    const provinceVal = province.value.trim();
    const cityVal = city.value.trim();
    const postalVal = postalCode.value.trim();
    const composed = composeAddress({
      province: provinceVal,
      city: cityVal,
      street: streetVal,
      plaque: plaqueVal,
      unit: unitVal,
      postalCode: postalVal,
    });

    return {
      ...extra,
      street: streetVal,
      plaque: plaqueVal,
      unit: unitVal,
      province: provinceVal,
      city: cityVal,
      postalCode: postalVal,
      deliveryAddress: composed,
      address: composed,
    };
  }

  return {
    street,
    plaque,
    unit,
    province,
    city,
    postalCode,
    cityOptions,
    errors,
    clearErrors,
    reset,
    loadFromAddress,
    validate,
    payload,
  };
}
