// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  ssr: true,

  routeRules: {
    '/admin/**': { ssr: false },
    '/profile/**': { ssr: false },
    '/cart/**': { ssr: false },
    '/checkout/**': { ssr: false },
    '/auth/**': { ssr: false },
  },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
    '@nuxt/icon',
  ],

  // Keep URLs without trailing slash (matches links + avoids nginx dir redirects)
  router: {
    options: {
      strict: false,
    },
  },

  nitro: {
    prerender: {
      crawlLinks: false,
      routes: ['/'],
    },
    devProxy: {
      '/uploads': { target: 'http://127.0.0.1:3001/uploads', changeOrigin: true },
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fa', dir: 'rtl' },
      title: 'آیتای | فروشگاه اینترنتی پوشاک',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        {
          name: 'description',
          content:
            'خرید آنلاین لباس زنانه، مردانه و بچگانه — کالکشن‌های فصل، ارسال سریع و پشتیبانی واقعی.',
        },
        { property: 'og:title', content: 'آیتای | فروشگاه اینترنتی پوشاک' },
        {
          property: 'og:description',
          content:
            'خرید آنلاین لباس زنانه، مردانه و بچگانه — کالکشن‌های فصل، ارسال سریع و پشتیبانی واقعی.',
        },
        { property: 'og:type', content: 'website' },
        { name: 'theme-color', content: '#652a3b' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
      style: [
        {
          innerHTML:
            'body{margin:0;background:#fff}#__nuxt:empty{display:flex;min-height:100vh;align-items:center;justify-content:center}#__nuxt:empty::after{content:"";width:2.5rem;height:2.5rem;border:3px solid #652a3b;border-top-color:transparent;border-radius:9999px;animation:kk-spin .8s linear infinite}@keyframes kk-spin{to{transform:rotate(360deg)}}',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/logo.png' },
        { rel: 'apple-touch-icon', href: '/pwa-192.png' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  icon: {
    size: '20px',
    class: 'icon',
    mode: 'svg',
    serverBundle: {
      collections: ['lucide', 'heroicons'],
    },
  },

  runtimeConfig: {
    public: {
      // Local: set NUXT_PUBLIC_API_BASE in .env (http://localhost:3001/api)
      // Production: usually /api behind nginx
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      /** فقط با `NUXT_PUBLIC_FORCE_DEMO_CATALOG=true` کاتالوگ نمایشی روشن می‌شود؛ پیش‌فرض = محصولات واقعی API */
      forceDemoCatalog: process.env.NUXT_PUBLIC_FORCE_DEMO_CATALOG === 'true',
    },
  },

  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      id: '/',
      name: 'آیتای | فروشگاه پوشاک',
      short_name: 'آیتای',
      description: 'فروشگاه اینترنتی پوشاک — زنانه، مردانه و بچگانه',
      theme_color: '#652a3b',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      lang: 'fa',
      dir: 'rtl',
      scope: '/',
      start_url: '/',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/\.well-known\//],
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,ttf}'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      runtimeCaching: [
        {
          urlPattern: /\/api\/(categories|products)/,
          handler: 'NetworkFirst',
          options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 } },
        },
      ],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: false,
      type: 'module',
    },
  },

  compatibilityDate: '2024-12-01',
});
