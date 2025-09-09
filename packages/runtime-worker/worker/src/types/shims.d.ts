declare module '@hierarchidb/feature-registry' {
  export class FeatureRegistry {
    register(_: any): void;

    startAll(): Promise<void>;
  }
}
declare module '@hierarchidb/tag' {
  export type TagDBPort = any;

  export class TagService {
    static getSingleton(_: any): Promise<any>;
  }

  export const featureDefinition: any;
}
declare module '@hierarchidb/import-export' {
  export type ImportExportDBPort = any;

  export class ImportExportService {
    static getSingleton(_: any): Promise<any>;
  }

  export function enableAllImporters(): void;

  export function enableAllExporters(): void;

  export const featureDefinition: any;
}
declare module '@hierarchidb/tabular' {
  export const featureDefinition: any;
}
declare module '@hierarchidb/tabular-xlsx' {
  export function installTabularXlsx(): void;

  export function markTabularXlsxInstalled(): void;

  export const featureDefinition: any;
}
declare module '@hierarchidb/compute' {
  export const featureDefinition: any;
}
declare module '@hierarchidb/batch' {
  export const featureDefinition: any;
}
declare module '@hierarchidb/download' {
  export const featureDefinition: any;
}
declare module '@hierarchidb/map-source' {
  export const featureDefinition: any;
}
declare module '@hierarchidb/map-view' {
  export const featureDefinition: any;
}
declare module '@hierarchidb/auth-recovery' {
  export const featureDefinition: any;

  export class AuthRecoveryService {
    static getSingleton(): Promise<any>;

    setToken(token: string, type?: 'Bearer' | 'Basic', expiresAt?: number): void;

    getAuthHeaders(): Record<string, string>;

    fetchWithAuth(url: string, init?: RequestInit, ctx?: any): Promise<Response>;
  }
}
