import { expose } from 'comlink';
import { setCorsProxyBaseURL } from '@hierarchidb/download';
import { fetchCountryAvailability } from '../../services/datasources/CountryAvailabilityResolver.js';
import type { CountryAvailabilityWorkerAPI, SerializedCountryAvailability } from './countryAvailability.types.js';
import { NodeId } from '@hierarchidb/common-types';

const corsProxyBaseURL = typeof import.meta.env?.VITE_CORS_PROXY_BASE_URL === 'string'
  ? import.meta.env.VITE_CORS_PROXY_BASE_URL
  : '';
if (corsProxyBaseURL) {
  setCorsProxyBaseURL(corsProxyBaseURL);
}

const api: CountryAvailabilityWorkerAPI = {
  async loadAvailability(dataSource: string, nodeId: NodeId): Promise<SerializedCountryAvailability> {
    const availability = await fetchCountryAvailability(dataSource, nodeId);
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
