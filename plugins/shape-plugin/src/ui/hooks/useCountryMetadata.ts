import { useCallback, useEffect, useState } from 'react';
import type { CountryMetadata, DataSourceName } from '~/common/types/index';
import type { NodeId } from '@hierarchidb/core-types';
import { metadataLoader } from '~/services/metadata/MetadataLoader';

export interface UseCountryMetadataOptions {
  dataSource: DataSourceName | undefined;
  countryCodes?: string[];
  nodeId: NodeId;
}

export interface UseCountryMetadataResult {
  metadata: CountryMetadata[];
  loading: boolean;
  error: Error | null;
  reload: (options?: { force?: boolean }) => Promise<void>;
  getCountryName: (countryCode: string) => string;
  getCountryByCode: (countryCode: string) => CountryMetadata | undefined;
}

/**
 * Hook to load and use country metadata via download-backed MetadataLoader
 */
export function useCountryMetadata({
  dataSource,
  countryCodes,
  nodeId,
}: UseCountryMetadataOptions): UseCountryMetadataResult {
  const [metadata, setMetadata] = useState<CountryMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadMetadata = useCallback(async (options?: { force?: boolean }) => {
    if (!dataSource) {
      const err = new Error('Data source is not set. Please go back to Data Source selection.');
      setError(err);
      setMetadata([]);
      setLoading(false);
      return;
    }

    if (options?.force) {
      // Clear in-memory cache so we can reload from the underlying chunk-store/network.
      metadataLoader.clearCache(dataSource);
    }

    setLoading(true);
    setError(null);

    try {
      let data: CountryMetadata[];

      if (countryCodes && countryCodes.length > 0) {
        data = await metadataLoader.getCountriesMetadata(dataSource, countryCodes, nodeId);
      } else {
        data = await metadataLoader.loadMetadata(dataSource, nodeId);
      }

      setMetadata(Array.isArray(data) ? data : []);

      if (!data?.length) {
        throw new Error(`No country metadata returned for data source: ${dataSource}`);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to load metadata');
      setError(e);
      setMetadata([]);
    } finally {
      setLoading(false);
    }
  }, [dataSource, countryCodes, nodeId]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  const getCountryName = useCallback(
    (countryCode: string): string => {
      const country = metadata.find(
        c => c.countryCode.toLowerCase() === countryCode.toLowerCase(),
      );
      return country?.countryName || countryCode;
    },
    [metadata],
  );

  const getCountryByCode = useCallback(
    (countryCode: string): CountryMetadata | undefined => {
      return metadata.find(
        c => c.countryCode.toLowerCase() === countryCode.toLowerCase(),
      );
    },
    [metadata],
  );

  return {
    metadata,
    loading,
    error,
    reload: loadMetadata,
    getCountryName,
    getCountryByCode,
  };
}
