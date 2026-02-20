import { i18n } from '@hierarchidb/ui-i18n';

// Vite/Rolldown will include these JSON files and trigger re-registration on HMR.
const localeModules = import.meta.glob('./locales/*.json', { eager: true });

Object.entries(localeModules).forEach(([path, mod]) => {
  const match = path.match(/locales\/([a-z-]+)\.json$/i);
  const lng = match?.[1];
  if (!lng) return;

  const resources = (mod as { default?: object }).default ?? mod;
  if (!resources) return;

  i18n.addResourceBundle(lng, 'plugin-basic-info', resources, true, true);
});

export { i18n };
