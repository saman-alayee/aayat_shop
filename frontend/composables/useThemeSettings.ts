import {
  applyThemeCssVars,
  DEFAULT_THEME,
  normalizeThemeColors,
  THEME_PRESETS,
  type ThemeColors,
} from '~/utils/themeColors';

export function useThemeSettings() {
  const api = useApi();
  const theme = useState<ThemeColors>('app-theme', () => ({ ...DEFAULT_THEME }));
  const loaded = useState('app-theme-loaded', () => false);

  function apply(next?: Partial<ThemeColors>) {
    const normalized = normalizeThemeColors(next ?? theme.value);
    theme.value = normalized;
    if (import.meta.client) {
      applyThemeCssVars(normalized);
    }
  }

  async function loadTheme() {
    try {
      const { data } = await api.get<ThemeColors>('/settings/theme');
      apply(data);
    } catch {
      apply(DEFAULT_THEME);
    } finally {
      loaded.value = true;
    }
  }

  async function saveTheme(next: ThemeColors) {
    const payload = normalizeThemeColors(next);
    const { data } = await api.put<ThemeColors>('/admin/settings/theme', payload);
    apply(data);
    return data;
  }

  return {
    theme,
    loaded,
    presets: THEME_PRESETS,
    apply,
    loadTheme,
    saveTheme,
  };
}
