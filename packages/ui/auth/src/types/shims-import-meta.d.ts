// Minimal ImportMeta.env shim for DTS bundling context
export {};

declare global {
  interface ImportMetaEnv {
    readonly DEV?: boolean;
    readonly PROD?: boolean;
    readonly MODE?: string;
    readonly BASE_URL?: string;
    // Vite-style VITE_* vars as strings
    readonly [key: string]: string | undefined;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
    readonly hot?: any;
  }
}
