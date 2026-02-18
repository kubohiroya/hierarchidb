import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSnackbar } from 'notistack';
import {
  useIsoCountries,
  type Country,
  type MatrixConfig,
  type MatrixSelection,
} from '@hierarchidb/ui-country-select';
import { useDialogContext } from '@hierarchidb/ui-dialog';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import type { CountryMetadata, ShapeEntity } from '../../../../common/types/index.js';
import {
  calculateEstimatedFeatures,
  calculateEstimatedSize,
  formatBytes,
  formatNumber,
} from '../../../../common/utils/estimates.js';
import { isDataSourceName, SHAPE_DATA_SOURCE_BY_NAME } from '../../../../common/types/index.js';
import type { NodeId } from '@hierarchidb/core-types';
import type { SerializedCountryAvailability } from '../../../workers/countryAvailability.types.js';
import {
  buildBootstrapCacheKey,
  countrySelectionBootstrapCache,
  isSelectionEqual,
  normalizeContinentCode,
  normalizeCountryCodeFromMetadata,
} from './selectionUtils.js';
import {
  getOrCreateAvailabilityWorkerHandle,
  type AvailabilityWorkerHandle,
} from './availabilityWorker.js';
import { invalidateBuildForSelectionChange } from './selectionInvalidate.js';

type Args = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
  nodeId: NodeId;
};

type CountrySelectionAvailabilityInfo = SerializedCountryAvailability | null;
type CountrySelectionState = {
  loading: boolean;
  error: Error | null;
  availabilityInfo: CountrySelectionAvailabilityInfo;
  matrixConfig: MatrixConfig;
  countries: Country[];
  selections: MatrixSelection[];
  applySelections: (nextSelections: MatrixSelection[]) => void;
  isCellEnabled: (countryCode: string, columnId: string) => boolean;
  reloadAll: () => Promise<void>;
};

const EMPTY_RESPONSE = {
  loading: false,
  error: null as Error | null,
  availabilityInfo: null as CountrySelectionAvailabilityInfo,
  matrixConfig: { columns: [], virtualization: { rowHeight: 40, overscan: 8 } },
  countries: [] as Country[],
  selections: [] as MatrixSelection[],
  applySelections: () => {},
  isCellEnabled: () => false,
  reloadAll: async () => {},
} satisfies CountrySelectionState;

export const useShapeCountrySelectionStep = ({ data, onChange, nodeId }: Args): CountrySelectionState => {
  const { enqueueSnackbar } = useSnackbar();
  const { onStepNavigate } = useDialogContext<Partial<ShapeEntity>>();
  const bridgeRef = useMemo(() => getBuildWorkerBridge(), []);
  const prevSelectionRef = useRef<Record<string, boolean[]> | null>(null);
  const selectedArrayByCountries = data.selectedArrayByCountries;

  const { dataSourceKey, dataSourceError } = useMemo(() => {
    const anyData = data as unknown as Record<string, unknown>;
    const hasData = Boolean(anyData && typeof anyData === 'object' && Object.keys(anyData).length > 0);
    const draftData = (anyData && typeof anyData === 'object' && 'draftData' in anyData)
      ? (anyData as { draftData?: unknown }).draftData as Record<string, unknown> | undefined
      : undefined;
    const buildConfig = (anyData && typeof anyData === 'object' && 'buildConfig' in anyData)
      ? (anyData as { buildConfig?: unknown }).buildConfig as Record<string, unknown> | undefined
      : undefined;
    const dsFromEntity = isDataSourceName(buildConfig?.dataSourceName) ? buildConfig.dataSourceName : undefined;
    const dsFromDraft = (() => {
      const bc = draftData?.buildConfig;
      if (!bc || typeof bc !== 'object') return undefined;
      const value = (bc as Record<string, unknown>).dataSourceName;
      return isDataSourceName(value) ? value : undefined;
    })();
    const candidate = dsFromDraft ?? dsFromEntity;
    const hasBatchConfig = Boolean(draftData?.buildConfig && typeof draftData.buildConfig === 'object');

    if (!candidate) {
      if (hasData && hasBatchConfig) {
        console.warn('[shape-plugin][country-selection] dataSource missing', {
          draftDataKeys: draftData ? Object.keys(draftData) : null,
        });
        return {
          dataSourceKey: undefined,
          dataSourceError: new Error('Data source is not set. Please go back to Data Source selection.'),
        };
      }
      return { dataSourceKey: undefined, dataSourceError: null as Error | null };
    }

    return { dataSourceKey: candidate, dataSourceError: null as Error | null };
  }, [data]);

  const resolvedMaxAdminLevel = useMemo(() => {
    if (!dataSourceKey) return 0;
    return SHAPE_DATA_SOURCE_BY_NAME[dataSourceKey]?.maxAdminLevel ?? 0;
  }, [dataSourceKey]);

  useEffect(() => {
    if (dataSourceError) onStepNavigate({ type: 'direct', targetIndex: 1 });
  }, [dataSourceError, onStepNavigate]);

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

  const error = dataSourceError ?? metadataError;

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

const isoContinentByCode = useMemo(() => {
  if (iso.status !== 'ready') return new Map<string, Country['continent']>();
  return new Map(iso.countries.map((country) => [country.code, country.continent]));
  }, [iso]);

  const iso3ToIso2 = useMemo(() => {
    return new Map(
      countries
        .map((country, index) => {
          const iso3 = country.iso3?.trim().toUpperCase();
          const iso2 = normalizeCountryCodeFromMetadata(country, index).trim().toUpperCase();
          if (!iso3 || !iso2 || iso2.length !== 2) return null;
          return [iso3, iso2] as const;
        })
        .filter((entry): entry is [string, string] => Boolean(entry)),
    );
  }, [countries]);

  const availabilityByCountryCode = useMemo(() => {
    if (!availability) return null;
    const map = new Map<string, number[]>();
    availability.entries.forEach((entry) => {
      const code = entry.countryCode?.trim().toUpperCase();
      if (!code) return;
      const levels = Array.from(new Set((entry.adminLevels ?? []).filter((level) => level >= 0))).sort((a, b) => a - b);
      map.set(code, levels);
    });
    return map;
  }, [availability]);

  const normalizedAvailabilityByCountry = useMemo(() => {
    if (!availabilityByCountryCode) return null;
    const map = new Map<string, number[]>();
    availabilityByCountryCode.forEach((levels, code) => {
      const normalized = code.trim().toUpperCase();
      const iso2 = normalized.length === 2 ? normalized : iso3ToIso2.get(normalized) ?? normalized;
      map.set(iso2, levels);
    });
    return map;
  }, [availabilityByCountryCode, iso3ToIso2]);

  const baseCountries = useMemo(() => {
    return countries.map((country, countryIndex) => {
      const normalizedCode = normalizeCountryCodeFromMetadata(country, countryIndex);
      const isoContinent = isoContinentByCode.get(normalizedCode);
  const normalizedContinent = normalizeContinentCode(country.continent) ?? isoContinent ?? 'XX';
      const resolvedLevels = normalizedAvailabilityByCountry?.get(normalizedCode)
        ?? country.availableAdminLevels
        ?? [];
      const normalizedLevels = Array.from(
        new Set(
          resolvedLevels
            .filter((level) => Number.isFinite(level) && level >= 0 && level <= resolvedMaxAdminLevel),
        ),
      ).sort((a, b) => a - b);
  return {
    country: {
      code: normalizedCode,
      name: country.countryName || normalizedCode || `#${countryIndex}`,
      nativeName: country.countryName,
      continent: normalizedContinent,
    },
        availableAdminLevels: normalizedLevels,
      };
    });
  }, [countries, isoContinentByCode, normalizedAvailabilityByCountry, resolvedMaxAdminLevel]);

  const normalizedSelection = useMemo<Record<string, boolean[]>>(() => {
    if (!selectedArrayByCountries || Array.isArray(selectedArrayByCountries)) return {};
    const resolveSelectionKey = (code: string) => {
      const normalized = code.trim().toUpperCase();
      return normalized.length === 2 ? normalized : iso3ToIso2.get(normalized) ?? normalized;
    };
    return Object.entries(selectedArrayByCountries).reduce<Record<string, boolean[]>>((acc, [code, row]) => {
      const selectionKey = resolveSelectionKey(code);
      if (!selectionKey) return acc;
      acc[selectionKey] = Array.from(
        { length: resolvedMaxAdminLevel + 1 },
        (_, idx) => Boolean(row?.[idx]),
      );
      return acc;
    }, {});
  }, [iso3ToIso2, resolvedMaxAdminLevel, selectedArrayByCountries]);

  const checkboxMatrix = useMemo<boolean[][]>(() => {
    return baseCountries.map((entry) => {
      const row = normalizedSelection[entry.country.code] ?? [];
      return Array.from({ length: resolvedMaxAdminLevel + 1 }, (_, idx) => Boolean(row[idx]));
    });
  }, [baseCountries, normalizedSelection, resolvedMaxAdminLevel]);

  useEffect(() => {
    if (!Array.isArray(selectedArrayByCountries)) return;
    if (Object.keys(normalizedSelection).length === 0) return;
    onChange({ selectedArrayByCountries: normalizedSelection });
  }, [normalizedSelection, onChange, selectedArrayByCountries]);

  useEffect(() => {
    if (!nodeId) return;
    if (Object.keys(normalizedSelection).length === 0) return;
    const prev = prevSelectionRef.current;
    if (!prev) {
      prevSelectionRef.current = normalizedSelection;
      return;
    }
    if (isSelectionEqual(prev, normalizedSelection)) return;
    prevSelectionRef.current = normalizedSelection;
    void invalidateBuildForSelectionChange({
      bridgeRef: bridgeRef as never,
      nodeId,
      prev,
      nextSelection: normalizedSelection,
    });
  }, [nodeId, normalizedSelection, bridgeRef]);

  useEffect(() => {
    if (baseCountries.length === 0) return;
    const nextSelection: Record<string, boolean[]> = {};
    baseCountries.forEach((entry) => {
      const row = normalizedSelection[entry.country.code] ?? [];
      nextSelection[entry.country.code] = Array.from(
        { length: resolvedMaxAdminLevel + 1 },
        (__, colIndex) => (entry.availableAdminLevels.includes(colIndex) ? Boolean(row[colIndex]) : false),
      );
    });
    if (!isSelectionEqual(normalizedSelection, nextSelection)) {
      onChange({ selectedArrayByCountries: nextSelection });
    }
  }, [baseCountries, normalizedSelection, onChange, resolvedMaxAdminLevel]);

  const columns: MatrixConfig['columns'] = useMemo(
    () => Array.from({ length: resolvedMaxAdminLevel + 1 }, (_, levelIndex) => ({
      id: `level-${levelIndex}`,
      label: `Level ${levelIndex}`,
      description: `Admin level ${levelIndex}`,
      type: 'custom',
    })),
    [resolvedMaxAdminLevel],
  );

  const matrixConfig: MatrixConfig = useMemo(() => ({
    columns,
    virtualization: { rowHeight: 40, overscan: 8 },
  }), [columns]);

  const currentSelections: MatrixSelection[] = useMemo(() => {
    return baseCountries.map((entry, countryIndex) => {
      const row = checkboxMatrix[countryIndex] ?? [];
      const selections: Record<string, boolean> = {};
      columns.forEach((col, levelIndex) => {
        selections[col.id] = Boolean(row[levelIndex]);
      });
      return { countryCode: entry.country.code, selections };
    });
  }, [baseCountries, checkboxMatrix, columns]);

  const countryList = useMemo<Country[]>(() => baseCountries.map((entry) => entry.country), [baseCountries]);

  const applySelections = useCallback((nextSelections: MatrixSelection[]) => {
    const nextSelection = baseCountries.reduce<Record<string, boolean[]>>((acc, entry) => {
      const found = nextSelections.find((sel) => sel.countryCode === entry.country.code);
      const row = columns.map((col) => {
        const isEnabled = entry.availableAdminLevels.includes(Number.parseInt(col.id.slice('level-'.length), 10));
        return isEnabled ? Boolean(found?.selections?.[col.id]) : false;
      });
      acc[entry.country.code] = row;
      return acc;
    }, {});
    onChange({ selectedArrayByCountries: nextSelection });
    const rows = Object.values(nextSelection);
    const totalSelected = rows.flat().filter(Boolean).length;
    const countriesWithSelection = rows.filter((row) => row.some(Boolean)).length;
    enqueueSnackbar(
      `${countriesWithSelection} countries / ${totalSelected} selections — Est. Size: ${formatBytes(
        calculateEstimatedSize(totalSelected),
      )}, Est. Features: ${formatNumber(calculateEstimatedFeatures(totalSelected, countries))}`,
      { variant: 'info' },
    );
  }, [baseCountries, columns, countries, enqueueSnackbar, onChange]);

  const isCellEnabled = useCallback(
    (countryCode: string, columnId: string) => {
      const entry = baseCountries.find((country) => country.country.code === countryCode);
      if (!entry) return false;
      const colIndex = columns.findIndex((col) => col.id === columnId);
      if (colIndex < 0) return false;
      return entry.availableAdminLevels.includes(colIndex);
    },
    [baseCountries, columns],
  );

  const reloadAll = useCallback(async () => {
    if (!dataSourceKey) return;
    countrySelectionBootstrapCache.delete(buildBootstrapCacheKey(nodeId, dataSourceKey));
    await loadAll({ force: true });
  }, [dataSourceKey, loadAll, nodeId]);

  const combinedLoading = metadataLoading || (availabilityLoading && !availability);

  if (!dataSourceKey) {
    return EMPTY_RESPONSE;
  }

  return {
    loading: Boolean(dataSourceKey) && combinedLoading,
    error,
    availabilityInfo: availability ?? null,
    matrixConfig,
    countries: countryList,
    selections: currentSelections,
    applySelections,
    isCellEnabled,
    reloadAll,
  };
};
