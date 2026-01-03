// Centralized module shim for xlsx ESM entry.
// Keep this in /types to avoid hand-maintained .d.ts under src/.

declare module 'xlsx/xlsx.mjs' {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  }

  export const utils: {
    sheet_to_json<T = Record<string, unknown>>(sheet: unknown, options?: Record<string, unknown>): T[];
    fs_stub?: unknown;
  };

  export function read(data: ArrayBuffer | Uint8Array, options?: Record<string, unknown>): WorkBook;
  export function set_fs(fs: unknown): void;
}

