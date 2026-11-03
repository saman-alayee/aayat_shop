/**
 * Keep window scroll at top on forward navigations.
 * Browser default scrollRestoration can leave you at the bottom of a shorter page.
 */
export default defineNuxtPlugin((nuxtApp) => {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  /** Skip forced top scroll for browser back/forward until page settles. */
  let skipNextTopScroll = false;

  window.addEventListener('popstate', () => {
    skipNextTopScroll = true;
  });

  const jumpTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const router = useRouter();

  router.afterEach((to, from) => {
    if (skipNextTopScroll) return;
    if (to.hash) return;
    if (to.fullPath === from.fullPath) return;

    jumpTop();
    nextTick(jumpTop);
  });

  nuxtApp.hook('page:finish', () => {
    if (skipNextTopScroll) {
      skipNextTopScroll = false;
      return;
    }
    const route = useRoute();
    if (route.hash) return;
    jumpTop();
  });
});
