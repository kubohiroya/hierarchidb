import { i18n } from '@hierarchidb/ui-i18n';

const localeModules = import.meta.glob('./locales/*.json', { eager: true });

Object.entries(localeModules).forEach(([path, mod]) => {
  const match = path.match(/locales\/([a-z-]+)\.json$/i);
  const lng = match?.[1];
  if (!lng) return;
  const resources = (mod as { default?: object }).default ?? mod;
  if (!resources) return;
  i18n.addResourceBundle(lng, 'shape-plugin', resources, true, true);
});

export { i18n };
