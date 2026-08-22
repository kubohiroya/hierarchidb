/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_PREFIX?: string;
  readonly VITE_APP_ANALYZE?: string;
  readonly VITE_APP_DTS?: string;
  readonly VITE_ROUTER_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module 'maplibre-gl/dist/maplibre-gl.css';

// NOTE: Module declarations for non-TS assets / ESM-entry shims live under /types/*.d.ts
