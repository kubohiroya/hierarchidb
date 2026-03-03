import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useIsoCountries } from '@hierarchidb/ui-country-select';
import type { NodeId } from '@hierarchidb/core-types';
import type { CountryMetadata } from '~/common/types/index';
import type { DataSourceName } from '~/common/types/index';
import type { SerializedCountryAvailability } from '~/ui/workers/countryAvailability.types';
import { buildBootstrapCacheKey, countrySelectionBootstrapCache } from './selectionUtils.js';
import { getOrCreateAvailabilityWorkerHandle, type AvailabilityWorkerHandle } from './getOrCreateAvailabilityWorkerHandle.js';

type LoaderProps = {
  dataSourceKey: DataSourceName | undefined;
  nodeId: NodeId;
};

export type CountrySelectionLoaderState = {
  iso: ReturnType<typeof useIsoCountries>;
  countries: CountryMetadata[];
  availability: SerializedCountryAvailability | null;
  metadataLoading: boolean;
  availabilityLoading: boolean;
  metadataError: Error | null;
  availabilityError: Error | null;
  loadAll: (options?: { force?: boolean }) => Promise<void>;
  reloadAll: () => Promise<void>;
};

export const useShapeCountrySelectionStepDataLoader = ({ dataSourceKey, nodeId }: LoaderProps): CountrySelectionLoaderState => {
  const { enqueueSnackbar } = useSnackbar();
  const iso = useIsoCountries();
  const [countries, setCountries] = useState<CountryMetadata[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<Error | null>(null);
  const [availability, setAvailability] = useState<SerializedCountryAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState<Error | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const metadataRequestIdRef = useRef(0);
  const availabilityRequestIdRef = useRef(0);
  const availabilityWorkerRef = useRef<AvailabilityWorkerHandle | null>(null);
  const availabilityBridgeReadyRef = useRef<Promise<void> | null>(null);

  const ensureAvailabilityWorker = useCallback(() => {
    if (availabilityWorkerRef.current && availabilityBridgeReadyRef.current) {
      return availabilityWorkerRef.current;
    }
    const handle = getOrCreateAvailabilityWorkerHandle();
    availabilityWorkerRef.current = { ...handle };
    availabilityBridgeReadyRef.current = handle.bridgeReady;
    return availabilityWorkerRef.current;
  }, []);

  useEffect(() => () => {
    availabilityWorkerRef.current = null;
    availabilityBridgeReadyRef.current = null;
  }, []);

  const isoCodeNormalizationWarnings = useMemo(() => {
    const unsupported = countries
      .filter((country) => {
        const iso2 = country.iso2?.trim();
        return !iso2 || iso2.length !== 2;
      })
      .map((country, index) => ({
        raw: country.countryCode,
        fallback: country.iso3,
        name: country.countryName,
        index,
      }))
      .slice(0, 5);
    if (unsupported.length === 0) return [];
    return unsupported.map((entry) => `${entry.name ?? entry.raw ?? entry.fallback ?? `#${entry.index}`}`);
  }, [countries]);

  useEffect(() => {
    if (isoCodeNormalizationWarnings.length === 0) return;
    console.warn('[shape-plugin][country-selection] Some countries could not be normalized to ISO2 and were kept as-is', {
      warnings: isoCodeNormalizationWarnings,
    });
    enqueueSnackbar('Some countries could not be normalized to ISO2 code and were kept as original code.', { variant: 'warning' });
  }, [enqueueSnackbar, isoCodeNormalizationWarnings]);

  const loadAvailability = useCallback(async (): Promise<SerializedCountryAvailability | null> => {
    if (!dataSourceKey) {
      setAvailability(null);
      return null;
    }
    const ref = ensureAvailabilityWorker();
    const requestId = availabilityRequestIdRef.current + 1;
    availabilityRequestIdRef.current = requestId;
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    try {
      const bridgeReady = availabilityBridgeReadyRef.current;
      if (!bridgeReady) throw new Error('UI storage bridge is not initialized for availability worker');
      await bridgeReady;
      const result = await ref.api.loadAvailability(dataSourceKey, nodeId);
      if (requestId !== availabilityRequestIdRef.current) return null;
      setAvailability(result);
      return result;
    } catch (e) {
      if (requestId !== availabilityRequestIdRef.current) return null;
      const err = e instanceof Error ? e : new Error(String(e));
      setAvailabilityError(err);
      setAvailability(null);
      return null;
    } finally {
      if (requestId === availabilityRequestIdRef.current) setAvailabilityLoading(false);
    }
  }, [dataSourceKey, ensureAvailabilityWorker, nodeId]);

  const loadMetadata = useCallback(async (options?: { force?: boolean }): Promise<CountryMetadata[] | null> => {
    if (!dataSourceKey) {
      setCountries([]);
      setMetadataError(null);
      setMetadataLoading(false);
      return null;
    }
    const ref = ensureAvailabilityWorker();
    const requestId = metadataRequestIdRef.current + 1;
    metadataRequestIdRef.current = requestId;
    setMetadataLoading(true);
    setMetadataError(null);
    try {
      const bridgeReady = availabilityBridgeReadyRef.current;
      if (!bridgeReady) throw new Error('UI storage bridge is not initialized for availability worker');
      await bridgeReady;
      const result = await ref.api.loadMetadata(dataSourceKey, nodeId, options);
      if (requestId !== metadataRequestIdRef.current) return null;
      setCountries(Array.isArray(result) ? result : []);
      if (!result?.length) throw new Error(`No country metadata returned for data source: ${dataSourceKey}`);
      return Array.isArray(result) ? result : [];
    } catch (e) {
      if (requestId !== metadataRequestIdRef.current) return null;
      const err = e instanceof Error ? e : new Error(String(e));
      setMetadataError(err);
      setCountries([]);
      return null;
    } finally {
      if (requestId === metadataRequestIdRef.current) setMetadataLoading(false);
    }
  }, [dataSourceKey, ensureAvailabilityWorker, nodeId]);

  const loadAll = useCallback(async (options?: { force?: boolean }) => {
    if (!dataSourceKey) {
      await loadMetadata(options);
      await loadAvailability();
      return;
    }
    const cacheKey = buildBootstrapCacheKey(nodeId, dataSourceKey);
    if (!options?.force) {
      const cached = countrySelectionBootstrapCache.get(cacheKey);
      if (cached) {
        setCountries(cached.countries);
        setMetadataError(null);
        setMetadataLoading(false);
        setAvailability(cached.availability);
        setAvailabilityError(null);
        setAvailabilityLoading(false);
        return;
      }
    } else {
      countrySelectionBootstrapCache.delete(cacheKey);
    }
    const metadata = await loadMetadata(options);
    const availabilityResult = await loadAvailability();
    if (metadata && metadata.length > 0) {
      countrySelectionBootstrapCache.set(cacheKey, {
        countries: metadata,
        availability: availabilityResult,
        fetchedAt: Date.now(),
      });
    }
  }, [dataSourceKey, loadAvailability, loadMetadata, nodeId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!availabilityError) return;
    enqueueSnackbar('Failed to load data source availability.', { variant: 'error' });
  }, [availabilityError, enqueueSnackbar]);

  useEffect(() => {
    if (!metadataError) return;
    enqueueSnackbar(metadataError.message, { variant: 'error' });
  }, [metadataError, enqueueSnackbar]);

  const reloadAll = useCallback(async () => {
    if (!dataSourceKey) return;
    countrySelectionBootstrapCache.delete(buildBootstrapCacheKey(nodeId, dataSourceKey));
    await loadAll({ force: true });
  }, [dataSourceKey, loadAll, nodeId]);

  return {
    iso,
    countries,
    availability,
    metadataLoading,
    availabilityLoading,
    metadataError,
    availabilityError,
    loadAll,
    reloadAll,
  };
};
