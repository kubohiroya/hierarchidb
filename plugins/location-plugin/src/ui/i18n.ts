import { i18n } from '@hierarchidb/ui-i18n';

// Vite will include these JSON files and HMR will trigger re-registration.
const localeModules = import.meta.glob('./locales/*.json', { eager: true });

Object.entries(localeModules).forEach(([path, mod]) => {
  const match = path.match(/locales\/([a-z-]+)\.json$/i);
  const lng = match?.[1];
  if (!lng) return;
  const resources = (mod as { default?: object }).default ?? mod;
  if (!resources) return;
  // overwrite=true, deep=true to refresh during HMR
  i18n.addResourceBundle(lng, 'location-plugin', resources, true, true);
});

export { i18n };
