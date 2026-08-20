import { expose } from 'comlink';
import {
  getOriginCoordinatorSourceSha,
  installOriginCoordinatorCensusResponder,
  type OriginCoordinatorMessageTarget,
} from '@hierarchidb/origin-coordinator';
import { setCorsProxyBaseURL } from '@hierarchidb/download';
import { fetchCountryAvailability } from '~/services/datasources/fetchCountryAvailability';
import type { CountryAvailabilityWorkerAPI, SerializedCountryAvailability, UiStorageBridge } from './countryAvailabilityTypes.js';
import type { NodeId } from '@hierarchidb/core-types';
import { metadataLoader } from '~/services/metadata/MetadataLoader';
import { AuthService } from '@hierarchidb/auth';
import type { DataSourceName } from '~/common/types/index';

installOriginCoordinatorCensusResponder(
  globalThis as unknown as OriginCoordinatorMessageTarget,
  getOriginCoordinatorSourceSha(),
);

const corsProxyBaseURL = typeof import.meta.env?.VITE_CORS_PROXY_BASE_URL === 'string'
  ? import.meta.env.VITE_CORS_PROXY_BASE_URL
  : '';
if (corsProxyBaseURL) {
  setCorsProxyBaseURL(corsProxyBaseURL);
}

const api: CountryAvailabilityWorkerAPI = {
  async setUiStorageBridge(bridge: UiStorageBridge): Promise<void> {
    const auth = await AuthService.getSingleton();
    await auth.setUiStorageBridge(bridge);
  },
  async loadAvailability(dataSource: DataSourceName, nodeId: NodeId): Promise<SerializedCountryAvailability> {
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
  async loadMetadata(dataSource: DataSourceName, nodeId: NodeId, options?: { force?: boolean }) {
    return metadataLoader.loadMetadata(dataSource, nodeId, options);
  },
  async clearMetadataCache(dataSource?: DataSourceName) {
    metadataLoader.clearCache(dataSource);
  },
};

expose(api);
