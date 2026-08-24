export type MapExportProfileMode = 'default-persistent' | 'explicit-persistent' | 'temporary-fresh';

export type MapExportCachePolicy = 'reuse' | 'fresh' | 'offline' | 'refresh';

export type ResolveMapExportProfilePolicyInput = {
  defaultProfileDir: string;
  profileDir?: string;
  fresh?: boolean;
  offline?: boolean;
  refresh?: boolean;
};

export type MapExportProfilePolicy = {
  profileMode: MapExportProfileMode;
  profileDir: string | null;
  cachePolicy: MapExportCachePolicy;
};
