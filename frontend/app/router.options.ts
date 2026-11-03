import type { RouterConfig } from '@nuxt/schema';

export default {
  scrollBehavior(to, from, savedPosition) {
    // Back/forward: restore previous position
    if (savedPosition) {
      return savedPosition;
    }

    if (to.hash) {
      return {
        el: to.hash,
        top: 0,
        behavior: 'smooth',
      };
    }

    // New navigation: always start at the top
    if (to.path !== from.path) {
      return { top: 0, left: 0 };
    }

    return { top: 0, left: 0 };
  },
} satisfies RouterConfig;
