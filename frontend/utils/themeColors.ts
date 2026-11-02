/** Shared storefront theme helpers (hex ↔ rgb channels + primary scale). */

export type ThemeColors = {
  primary: string;
  onPrimary: string;
  accent: string;
  pageBg: string;
  adminPageBg: string;
  surface: string;
  header: string;
  text: string;
  textMuted: string;
  border: string;
};

export const DEFAULT_THEME: ThemeColors = {
  primary: '#6f5644',
  onPrimary: '#ffffff',
  accent: '#a89b8d',
  pageBg: '#f6f1ea',
  adminPageBg: '#f6f1ea',
  surface: '#fffdfb',
  header: '#fffdfb',
  text: '#3c322b',
  textMuted: '#6b5e55',
  border: '#e7e0d8',
};

export const THEME_PRESETS: Array<{ id: string; label: string; colors: ThemeColors }> = [
  {
    id: 'brown',
    label: 'قهوه‌ای آیتای',
    colors: { ...DEFAULT_THEME },
  },
  {
    id: 'olive',
    label: 'سبز زیتونی',
    colors: {
      primary: '#5a6b4a',
      onPrimary: '#ffffff',
      accent: '#8f9c7e',
      pageBg: '#f1efe6',
      adminPageBg: '#eef2e8',
      surface: '#fbfaf6',
      header: '#fbfaf6',
      text: '#2f3429',
      textMuted: '#5c6754',
      border: '#dde3d4',
    },
  },
  {
    id: 'navy',
    label: 'سرمه‌ای',
    colors: {
      primary: '#2f4a6b',
      onPrimary: '#ffffff',
      accent: '#7a8fa8',
      pageBg: '#eef2f7',
      adminPageBg: '#e8eef6',
      surface: '#f7f9fc',
      header: '#f7f9fc',
      text: '#1e293b',
      textMuted: '#64748b',
      border: '#d7e0ea',
    },
  },
  {
    id: 'warm-cream',
    label: 'کرم گرم',
    colors: {
      primary: '#9a6b45',
      onPrimary: '#ffffff',
      accent: '#c4a484',
      pageBg: '#f8efe4',
      adminPageBg: '#f6eadc',
      surface: '#fffaf4',
      header: '#fffaf4',
      text: '#3b2a1d',
      textMuted: '#7a6454',
      border: '#eadccb',
    },
  },
  {
    id: 'clay',
    label: 'خاک رسی',
    colors: {
      primary: '#a05a45',
      onPrimary: '#ffffff',
      accent: '#c48b78',
      pageBg: '#f7efe9',
      adminPageBg: '#f3e8e1',
      surface: '#fffaf7',
      header: '#fffaf7',
      text: '#3d2a24',
      textMuted: '#7a5a50',
      border: '#e8d5cb',
    },
  },
  {
    id: 'sand',
    label: 'شن و ماسه',
    colors: {
      primary: '#8a7a5c',
      onPrimary: '#ffffff',
      accent: '#b6a88a',
      pageBg: '#f5f1e8',
      adminPageBg: '#efe9dc',
      surface: '#fcfaf5',
      header: '#fcfaf5',
      text: '#3a3428',
      textMuted: '#6e6554',
      border: '#e2d9c6',
    },
  },
  {
    id: 'wine',
    label: 'زرشکی',
    colors: {
      primary: '#7a3b46',
      onPrimary: '#ffffff',
      accent: '#b07a84',
      pageBg: '#f7f0f1',
      adminPageBg: '#f1e6e8',
      surface: '#fcf8f9',
      header: '#fcf8f9',
      text: '#3a2428',
      textMuted: '#73555b',
      border: '#e5d3d6',
    },
  },
  {
    id: 'forest',
    label: 'سبز جنگلی',
    colors: {
      primary: '#3f5d4a',
      onPrimary: '#ffffff',
      accent: '#7d9a86',
      pageBg: '#eef3ef',
      adminPageBg: '#e6eee8',
      surface: '#f7faf8',
      header: '#f7faf8',
      text: '#243028',
      textMuted: '#55685c',
      border: '#d4e0d7',
    },
  },
  {
    id: 'slate',
    label: 'سنگی',
    colors: {
      primary: '#4b5563',
      onPrimary: '#ffffff',
      accent: '#8b95a3',
      pageBg: '#f1f3f5',
      adminPageBg: '#e8ecf0',
      surface: '#f8fafb',
      header: '#f8fafb',
      text: '#1f2933',
      textMuted: '#64707d',
      border: '#d5dbe2',
    },
  },
  {
    id: 'teal',
    label: 'فیروزه‌ای ملایم',
    colors: {
      primary: '#3d6b6b',
      onPrimary: '#ffffff',
      accent: '#7aa0a0',
      pageBg: '#eef4f4',
      adminPageBg: '#e5efef',
      surface: '#f7fbfb',
      header: '#f7fbfb',
      text: '#243333',
      textMuted: '#567070',
      border: '#d2e0e0',
    },
  },
  {
    id: 'mocha',
    label: 'موکا',
    colors: {
      primary: '#5c4638',
      onPrimary: '#ffffff',
      accent: '#9a8070',
      pageBg: '#f3ebe4',
      adminPageBg: '#ebe0d6',
      surface: '#faf6f2',
      header: '#faf6f2',
      text: '#2e241e',
      textMuted: '#6b574a',
      border: '#ddd0c4',
    },
  },
  {
    id: 'blush',
    label: 'صورتی خاکی',
    colors: {
      primary: '#9a6b72',
      onPrimary: '#ffffff',
      accent: '#c4a0a6',
      pageBg: '#f8f1f2',
      adminPageBg: '#f2e7e9',
      surface: '#fcf8f9',
      header: '#fcf8f9',
      text: '#3d2c30',
      textMuted: '#7a5f64',
      border: '#e8d6d9',
    },
  },
  {
    id: 'ink',
    label: 'مشکی جوهر',
    colors: {
      primary: '#2c2c2c',
      onPrimary: '#ffffff',
      accent: '#8a8a8a',
      pageBg: '#f2f2f2',
      adminPageBg: '#ebebeb',
      surface: '#fafafa',
      header: '#fafafa',
      text: '#1a1a1a',
      textMuted: '#666666',
      border: '#d9d9d9',
    },
  },
  {
    id: 'saffron',
    label: 'زعفرانی',
    colors: {
      primary: '#b07a2e',
      onPrimary: '#ffffff',
      accent: '#d4ad6a',
      pageBg: '#faf4ea',
      adminPageBg: '#f5ebda',
      surface: '#fffbf4',
      header: '#fffbf4',
      text: '#3d2f18',
      textMuted: '#7a6540',
      border: '#ead9b8',
    },
  },
];

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function normalizeHex(value: string, fallback: string): string {
  const raw = value.trim();
  if (HEX_RE.test(raw)) return raw.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return fallback.toLowerCase();
}

export function hexToRgbChannels(hex: string): string {
  const normalized = normalizeHex(hex, '#000000').slice(1);
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const normalized = normalizeHex(hex, '#000000').slice(1);
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgbChannels(h: number, s: number, l: number): string {
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return `${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}`;
}

/** Build Tailwind-like 50–900 scale from a brand hex (600 ≈ brand). */
export function buildPrimaryScale(primaryHex: string): Record<string, string> {
  const { h, s } = hexToHsl(primaryHex);
  const lightnesses: Record<string, number> = {
    '50': 0.97,
    '100': 0.94,
    '200': 0.88,
    '300': 0.8,
    '400': 0.68,
    '500': 0.55,
    '600': 0.42,
    '700': 0.35,
    '800': 0.28,
    '900': 0.22,
  };
  const scale: Record<string, string> = {};
  for (const [step, l] of Object.entries(lightnesses)) {
    scale[step] = hslToRgbChannels(h, Math.min(0.55, Math.max(0.12, s)), l);
  }
  // Keep 600 closest to the chosen brand color.
  scale['600'] = hexToRgbChannels(primaryHex);
  return scale;
}

export function themeToCssVars(theme: ThemeColors): Record<string, string> {
  const primary = buildPrimaryScale(theme.primary);
  const accent = hexToHsl(theme.accent);
  return {
    '--color-primary-50': primary['50'],
    '--color-primary-100': primary['100'],
    '--color-primary-200': primary['200'],
    '--color-primary-300': primary['300'],
    '--color-primary-400': primary['400'],
    '--color-primary-500': primary['500'],
    '--color-primary-600': primary['600'],
    '--color-primary-700': primary['700'],
    '--color-primary-800': primary['800'],
    '--color-primary-900': primary['900'],
    '--color-accent-400': hslToRgbChannels(accent.h, accent.s, Math.min(0.75, accent.l + 0.12)),
    '--color-accent-500': hexToRgbChannels(theme.accent),
    '--color-accent-600': hslToRgbChannels(accent.h, accent.s, Math.max(0.25, accent.l - 0.1)),
    '--color-surface': hexToRgbChannels(theme.surface),
    '--color-surface-muted': hexToRgbChannels(theme.pageBg),
    '--color-surface-dark': hexToRgbChannels(theme.text),
    '--color-page': hexToRgbChannels(theme.pageBg),
    '--color-admin-page': hexToRgbChannels(theme.adminPageBg),
    '--color-header': hexToRgbChannels(theme.header),
    '--color-text': hexToRgbChannels(theme.text),
    '--color-text-muted': hexToRgbChannels(theme.textMuted),
    '--color-border': hexToRgbChannels(theme.border),
    '--color-on-primary': hexToRgbChannels(theme.onPrimary),
  };
}

export function applyThemeCssVars(theme: ThemeColors, target: HTMLElement = document.documentElement) {
  const vars = themeToCssVars(theme);
  for (const [key, value] of Object.entries(vars)) {
    target.style.setProperty(key, value);
  }
  target.classList.add('theme-live');
}

type LegacyTheme = Partial<ThemeColors> & { surfaceMuted?: string };

export function normalizeThemeColors(raw: LegacyTheme | null | undefined): ThemeColors {
  const pageFallback = raw?.pageBg || raw?.surfaceMuted || DEFAULT_THEME.pageBg;
  return {
    primary: normalizeHex(raw?.primary || '', DEFAULT_THEME.primary),
    onPrimary: normalizeHex(raw?.onPrimary || '', DEFAULT_THEME.onPrimary),
    accent: normalizeHex(raw?.accent || '', DEFAULT_THEME.accent),
    pageBg: normalizeHex(pageFallback, DEFAULT_THEME.pageBg),
    adminPageBg: normalizeHex(raw?.adminPageBg || pageFallback, DEFAULT_THEME.adminPageBg),
    surface: normalizeHex(raw?.surface || '', DEFAULT_THEME.surface),
    header: normalizeHex(raw?.header || raw?.surface || '', DEFAULT_THEME.header),
    text: normalizeHex(raw?.text || '', DEFAULT_THEME.text),
    textMuted: normalizeHex(raw?.textMuted || '', DEFAULT_THEME.textMuted),
    border: normalizeHex(raw?.border || '', DEFAULT_THEME.border),
  };
}
