import { expose } from 'comlink';
import { fetchCountryAvailability } from '../../services/datasources/CountryAvailabilityResolver.js';
import type { CountryAvailabilityWorkerAPI, SerializedCountryAvailability } from './countryAvailability.types.js';

const api: CountryAvailabilityWorkerAPI = {
  async loadAvailability(dataSource: string): Promise<SerializedCountryAvailability> {
    const availability = await fetchCountryAvailability(dataSource);
    return {
      dataSource: availability.dataSource,
      entries: Array.from(availability.availableAdminLevels.entries()).map(([countryCode, adminLevels]) => ({
        countryCode,
        adminLevels,
      })),
      maxAdminLevel: availability.maxAdminLevel,
      source: availability.source,
      fetchedAt: Date.now(),
    };
  },
};

expose(api);
