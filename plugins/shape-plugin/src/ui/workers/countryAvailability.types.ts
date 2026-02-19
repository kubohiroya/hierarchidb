export type SerializedCountryAvailabilityEntry = {
  countryCode: string;
  adminLevels: number[];
};

export type SerializedCountryAvailability = {
  dataSource: DataSourceName;
  entries: SerializedCountryAvailabilityEntry[];
  maxAdminLevel: number;
  source: 'strategy' | 'metadata' | 'none';
  fetchedAt: number;
};

export type UiStorageBridge = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export interface CountryAvailabilityWorkerAPI {
  setUiStorageBridge(bridge: UiStorageBridge): Promise<void>;
  loadAvailability(dataSource: DataSourceName, nodeId: string): Promise<SerializedCountryAvailability>;
  loadMetadata(
    dataSource: DataSourceName,
    nodeId: string,
    options?: { force?: boolean },
  ): Promise<CountryMetadata[]>;
  clearMetadataCache(dataSource?: DataSourceName): Promise<void>;
}
import type { CountryMetadata, DataSourceName } from '~/common/types/index';
