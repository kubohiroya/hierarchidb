declare module '@hierarchidb/fetch-save-metadata/output/*.json' {
  const data: any[];
  export default data;
}

declare module '@hierarchidb/runtime-shared-batch-processor' {
  export type BatchProgressEvent = import('@hierarchidb/common-api').BatchProgressEvent;
  export type BatchSessionStatus = import('@hierarchidb/common-api').BatchSessionStatus;
}

declare module '@hierarchidb/compute' {
  export * from '../../../../packages/features/compute/src/index';
}

declare module '@hierarchidb/common-types' {
  export * from '../../../../packages/common/types/dist/index.d.ts';
}

declare module '@hierarchidb/common-api' {
  export * from '../../../../packages/common/api/dist/index.d.ts';
}

declare module '@hierarchidb/common-auth' {
  export * from '../../../../packages/common/auth/dist/index.d.ts';
}

declare module '@hierarchidb/auth-recovery' {
  export * from '../../../../packages/features/auth-recovery/dist/index.d.ts';
}

declare module '@hierarchidb/util' {
  export * from '../../../../packages/util/dist/index.d.ts';
}

declare module '@hierarchidb/tabular-source' {
  export * from '../../../../packages/features/tabular-source/dist/index.d.ts';
}

declare module '@hierarchidb/tabular-store' {
  export * from '../../../../packages/features/tabular-store/dist/index.d.ts';
}

declare module '@hierarchidb/download' {
  export * from '../../../../packages/features/download/dist/index.d.ts';
}

declare module '@hierarchidb/feature-registry' {
  export * from '../../../../packages/features/feature-registry/dist/index.d.ts';
}

declare module '@hierarchidb/import-export' {
  export * from '../../../../packages/features/import-export/dist/index.d.ts';
}

declare module '@hierarchidb/map-source' {
  export * from '../../../../packages/features/map-source/dist/index.d.ts';
}

declare module '@hierarchidb/plugin-runtime-services' {
  export * from '../../../../packages/plugin-runtime-services/dist/index.d.ts';
}

declare module '@hierarchidb/plugin-ui-sdk' {
  export * from '../../../../packages/plugin-ui-sdk/dist/index.d.ts';
}

declare module '@hierarchidb/plugin-service-sdk' {
  export * from '../../../../packages/plugin-service-sdk/dist/index.d.ts';
}

declare module '@hierarchidb/tag' {
  export * from '../../../../packages/features/tag/dist/index.d.ts';
}

declare module '@hierarchidb/batch' {
  export * from '../../../../packages/features/batch/dist/index.d.ts';
}

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
