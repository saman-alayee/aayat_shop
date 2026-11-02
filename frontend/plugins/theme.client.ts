export default defineNuxtPlugin(() => {
  const { loadTheme } = useThemeSettings();
  void loadTheme();
});
