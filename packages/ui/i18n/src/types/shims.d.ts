// Temporary shims to unblock TS 4.9 in ESM + pnpm workspaces
// Remove once the repo upgrades to TS 5 with NodeNext/Bundler resolution

declare module 'i18next-browser-languagedetector';
declare module 'i18next-http-backend';

declare module 'date-fns/locale' {
  export const enUS: unknown;
  export const ja: unknown;
}

