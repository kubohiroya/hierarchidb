/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_PREFIX: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly hot?: import('vite/types/hot').ViteHotContext;
}
