import type { Product } from '~/types';
import type { Ref } from 'vue';
import {
  PRODUCT_IMAGE_PLACEHOLDER,
  demoMediaUrl,
  hoverProductImageUrl,
  primaryProductImageUrl,
} from '~/utils/productMedia';

function localPrimaryUrl(product: Product): string {
  return demoMediaUrl(`product-${product.slug || product.id}-primary`);
}

function localHoverUrl(product: Product): string {
  return demoMediaUrl(`product-${product.slug || product.id}-hover`);
}

/** تصویر کارت محصول + هاور امن (بدون خالی شدن اگر تصویر دوم لود نشود). */
export function useProductCardImages(productSource: Ref<Product> | Product) {
  const product = computed(() => unref(productSource));

  const primarySrc = ref(primaryProductImageUrl(product.value));
  const hoverSrc = ref<string | null>(hoverProductImageUrl(product.value));
  const hoverReady = ref(false);
  const hoverEnabled = computed(() => Boolean(hoverSrc.value && hoverReady.value));

  let preloadToken = 0;

  function syncFromProduct() {
    preloadToken++;
    primarySrc.value = primaryProductImageUrl(product.value);
    hoverSrc.value = hoverProductImageUrl(product.value);
    hoverReady.value = false;
    preloadHover();
  }

  function onPrimaryError() {
    const local = localPrimaryUrl(product.value);
    if (primarySrc.value !== local) {
      primarySrc.value = local;
      return;
    }
    if (primarySrc.value !== PRODUCT_IMAGE_PLACEHOLDER) {
      primarySrc.value = PRODUCT_IMAGE_PLACEHOLDER;
    }
  }

  function onHoverError() {
    const local = localHoverUrl(product.value);
    if (hoverSrc.value !== local && local !== primarySrc.value) {
      hoverSrc.value = local;
      hoverReady.value = false;
      preloadHover();
      return;
    }
    hoverSrc.value = null;
    hoverReady.value = false;
  }

  function preloadHover() {
    const url = hoverSrc.value;
    if (!url || hoverReady.value) return;
    const token = ++preloadToken;
    const img = new Image();
    img.onload = () => {
      if (token === preloadToken) hoverReady.value = true;
    };
    img.onerror = () => {
      if (token === preloadToken) onHoverError();
    };
    img.src = url;
  }

  function primeImages() {
    preloadHover();
  }

  watch(
    () => product.value.id,
    () => syncFromProduct()
  );

  onMounted(() => {
    preloadHover();
  });

  return {
    primarySrc,
    hoverSrc,
    hoverReady,
    hoverEnabled,
    onPrimaryError,
    onHoverError,
    preloadHover,
    primeImages,
    placeholder: PRODUCT_IMAGE_PLACEHOLDER,
  };
}
