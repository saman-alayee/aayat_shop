/** @type {import('tailwindcss').Config} */
export default {
  content: [],
  theme: {
    extend: {
      colors: {
        /** Inspired by minimal apparel storefronts: deep wine + neutral grays */
        primary: {
          50: '#faf5f6',
          100: '#f3e8eb',
          200: '#e7d1d7',
          300: '#d4aab5',
          400: '#b97a8a',
          500: '#9f4d62',
          600: '#7a3347',
          700: '#652a3b',
          800: '#552433',
          900: '#49202d',
        },
        accent: {
          400: '#c9a962',
          500: '#b8924a',
          600: '#9a7838',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f7f7f7',
          dark: '#111111',
        },
      },
      fontFamily: {
        sans: ['IRANSansX', 'Tahoma', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0, 0, 0, 0.06)',
        float: '0 -4px 24px rgba(0, 0, 0, 0.08)',
        header: '0 1px 0 rgba(0, 0, 0, 0.06)',
      },
      maxWidth: {
        store: '1280px',
      },
    },
  },
  plugins: [],
};
