import { useState, useEffect, useCallback } from 'react';
import type { CountryMetadata } from '~/types';
import { metadataLoader } from '~/services/metadata/MetadataLoader';

export interface UseCountryMetadataOptions {
  dataSource: string;
  countryCodes?: string[];
}

export interface UseCountryMetadataResult {
  metadata: CountryMetadata[];
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  getCountryName: (countryCode: string) => string;
  getCountryByCode: (countryCode: string) => CountryMetadata | undefined;
}

/**
 * Hook to load and use country metadata from 02-fetch-metadata
 */
export function useCountryMetadata({
  dataSource,
  countryCodes,
}: UseCountryMetadataOptions): UseCountryMetadataResult {
  const [metadata, setMetadata] = useState<CountryMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadMetadata = useCallback(async () => {
    if (!dataSource) {
      setMetadata([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let data: CountryMetadata[];
      
      if (countryCodes && countryCodes.length > 0) {
        data = await metadataLoader.getCountriesMetadata(dataSource, countryCodes);
      } else {
        data = await metadataLoader.loadMetadata(dataSource);
      }
      
      setMetadata(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load metadata'));
      setMetadata([]);
    } finally {
      setLoading(false);
    }
  }, [dataSource, countryCodes]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  const getCountryName = useCallback(
    (countryCode: string): string => {
      const country = metadata.find(
        c => c.countryCode.toLowerCase() === countryCode.toLowerCase()
      );
      return country?.countryName || countryCode;
    },
    [metadata]
  );

  const getCountryByCode = useCallback(
    (countryCode: string): CountryMetadata | undefined => {
      return metadata.find(
        c => c.countryCode.toLowerCase() === countryCode.toLowerCase()
      );
    },
    [metadata]
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