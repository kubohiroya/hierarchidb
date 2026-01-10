export type SerializedCountryAvailabilityEntry = {
  countryCode: string;
  adminLevels: number[];
};

export type SerializedCountryAvailability = {
  dataSource: string;
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
  loadAvailability(dataSource: string, nodeId: string): Promise<SerializedCountryAvailability>;
  loadMetadata(dataSource: string, nodeId: string): Promise<CountryMetadata[]>;
  clearMetadataCache(dataSource?: string): Promise<void>;
}
import type { CountryMetadata } from '../../common/types/index.js';
