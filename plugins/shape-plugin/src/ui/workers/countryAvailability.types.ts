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

export interface CountryAvailabilityWorkerAPI {
  loadAvailability(dataSource: string, nodeId: string): Promise<SerializedCountryAvailability>;
  loadMetadata(dataSource: string, nodeId: string): Promise<CountryMetadata[]>;
  clearMetadataCache(dataSource?: string): Promise<void>;
}
import type { CountryMetadata } from '../../common/types/index.js';
