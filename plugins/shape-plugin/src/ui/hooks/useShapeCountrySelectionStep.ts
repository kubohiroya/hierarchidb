import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useIsoCountries, type MatrixConfig, type MatrixSelection, type ContinentCode } from '@hierarchidb/ui-country-select';
import type { CountryMetadata, ShapeEntity } from '../../common/types/index.js';
import { useCountryMetadata } from './useCountryMetadata.js';
import {
  calculateEstimatedFeatures,
  calculateEstimatedSize,
  DATA_SOURCE_CONFIGS,
  formatBytes,
  formatNumber,
} from '../../common/mock/data.js';
import { normalizeDataSourceName } from '../../services/utils/utils.js';
import { clearStagesIfPresent, FULL_INVALIDATION_STAGES, resolveShapeNodeId } from '../utils/sessionInvalidation.js';
import type { CountryAvailabilityWorkerAPI, SerializedCountryAvailability } from '../workers/countryAvailability.types.js';
import { wrap, releaseProxy } from 'comlink';
import { invalidateCountrySelectionCaches } from './countrySelectionReload.js';
import { SHARED_SHAPE_NODE_ID } from '../../services/utils/chunkStore.js';

// (availability is loaded in a dedicated worker thread)

const createAvailabilityWorker = () => new Worker(
  new URL('../workers/countryAvailability.worker.ts', import.meta.url),
  { type: 'module' },
);

const CONTINENT_CODES: ContinentCode[] = ['AF', 'AS', 'EU', 'NA', 'SA', 'OC', 'AN', 'XX'];

const CONTINENT_ALIASES: Record<string, ContinentCode> = {
  africa: 'AF',
  af: 'AF',
  asia: 'AS',
  as: 'AS',
  europe: 'EU',
  eu: 'EU',
  'north america': 'NA',
  na: 'NA',
  'south america': 'SA',
  sa: 'SA',
  'central america': 'NA',
  oceania: 'OC',
  australia: 'OC',
  oc: 'OC',
  antarctica: 'AN',
  an: 'AN',
  'n/a': 'XX',
  'unknown': 'XX',
  'unspecified': 'XX',
  'none': 'XX',
  '不明': 'XX',
  '不詳': 'XX',
};

const isContinentCode = (value: string): value is ContinentCode => CONTINENT_CODES.includes(value as ContinentCode);

const normalizeContinentCode = (continent?: string): ContinentCode | undefined => {
  if (!continent) return undefined;
  const trimmed = continent.trim();
  if (!trimmed) return undefined;
  const alias = CONTINENT_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  const upper = trimmed.toUpperCase();
  if (isContinentCode(upper)) return upper;
  return undefined;
};

const normalizeCountryCodeFromMetadata = (country: Partial<CountryMetadata>, index: number): string => {
  const iso2 = country.iso2?.trim();
  if (iso2) return iso2.toUpperCase();
  const countryCode = country.countryCode?.trim();
  if (countryCode) return countryCode.toUpperCase();
  return `COUNTRY-${index}`;
};

const isSelectionEqual = (
  left?: Record<string, boolean[]>,
  right?: Record<string, boolean[]>,
): boolean => {
  if (!left || !right) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let i = 0; i < leftKeys.length; i += 1) {
    if (leftKeys[i] !== rightKeys[i]) return false;
  }
  return leftKeys.every((key) => {
    const leftRow = left[key] ?? [];
    const rightRow = right[key] ?? [];
    if (leftRow.length !== rightRow.length) return false;
    for (let colIndex = 0; colIndex < leftRow.length; colIndex += 1) {
      if (Boolean(leftRow[colIndex]) !== Boolean(rightRow[colIndex])) return false;
    }
    return true;
  });
};

// Availability is resolved in a worker (and AuthRequired notifications are bridged to UI).

type Args = {
  data: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
  nodeId?: string;
};

export const useShapeCountrySelectionStep = ({ data, onChange, nodeId: _nodeId }: Args) => {
  const { enqueueSnackbar } = useSnackbar();

  // Current selection value must be available before any derived useMemo.
  const selectedArrayByCountries = data.selectedArrayByCountries;

  const { dataSourceKey, dataSourceError } = useMemo(() => {
    const anyData = data as unknown as Record<string, unknown>;

    const draftData = (anyData && typeof anyData === 'object' && 'draftData' in anyData)
      ? (anyData as { draftData?: unknown }).draftData as Record<string, unknown> | undefined
      : undefined;

    const batchConfig = (anyData && typeof anyData === 'object' && 'batchConfig' in anyData)
      ? (anyData as { batchConfig?: unknown }).batchConfig as Record<string, unknown> | undefined
      : undefined;

    const dsFromEntity = typeof batchConfig?.dataSource === 'string' ? batchConfig.dataSource : undefined;

    const dsFromDraft = (() => {
      const bc = draftData?.batchConfig;
      if (!bc || typeof bc !== 'object') return undefined;
      const value = (bc as Record<string, unknown>).dataSource;
      return typeof value === 'string' ? value : undefined;
    })();

    const dsFromEntityName = typeof (anyData as { dataSourceName?: unknown }).dataSourceName === 'string'
      ? (anyData as { dataSourceName: string }).dataSourceName
      : undefined;

    const dsFromDraftName = typeof (draftData as { dataSourceName?: unknown } | undefined)?.dataSourceName === 'string'
      ? (draftData as { dataSourceName: string }).dataSourceName
      : undefined;

    const candidate = dsFromDraft ?? dsFromEntity ?? dsFromDraftName ?? dsFromEntityName;
    const normalized = normalizeDataSourceName(candidate);

    if (!normalized) {
      // Don't guess a data source (no implicit fallback to GADM).
      // Surface as an error and skip network work.
      console.warn('[shape-plugin][step3] dataSource missing', {
        batchConfigKeys: batchConfig ? Object.keys(batchConfig) : null,
        dataSourceName: (anyData as { dataSourceName?: unknown }).dataSourceName,
        draftDataKeys: draftData ? Object.keys(draftData) : null,
      });
      return {
        dataSourceKey: undefined as unknown as string | undefined,
        dataSourceError: new Error('Data source is not set. Please go back to Step2 and select a data source.'),
      };
    }

    return { dataSourceKey: normalized, dataSourceError: null as Error | null };
  }, [data]);

  const resolvedMaxAdminLevel = useMemo(() => {
    if (!dataSourceKey) return 0;
    const normalized = normalizeDataSourceName(dataSourceKey) ?? dataSourceKey.toLowerCase();
    return DATA_SOURCE_CONFIGS[normalized]?.maxAdminLevel ?? 0;
  }, [dataSourceKey]);

  const iso = useIsoCountries();
  const sharedNodeId = SHARED_SHAPE_NODE_ID;

  const { metadata: countries, loading: metadataLoading, error: metadataError, reload: reloadMetadata } = useCountryMetadata({
    dataSource: dataSourceKey ?? '',
    nodeId: sharedNodeId,
  });

  const error = dataSourceError ?? metadataError;

  const [availability, setAvailability] = useState<SerializedCountryAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState<Error | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const availabilityWorkerRef = useRef<{
    worker: Worker;
    api: ReturnType<typeof wrap<CountryAvailabilityWorkerAPI>>;
  } | null>(null);
  const availabilityRequestIdRef = useRef(0);

  useEffect(() => {
    const worker = createAvailabilityWorker();
    const api = wrap<CountryAvailabilityWorkerAPI>(worker);
    availabilityWorkerRef.current = { worker, api };
    return () => {
      availabilityWorkerRef.current = null;
      try {
        api[releaseProxy]?.();
      } catch (releaseError) {
        console.warn('[ShapeCountrySelectionStep] failed to release availability worker', releaseError);
      }
      worker.terminate();
    };
  }, []);

  const loadAvailability = useCallback(async () => {
    if (!dataSourceKey) {
      setAvailability(null);
      return;
    }
    const ref = availabilityWorkerRef.current;
    if (!ref) return;

    const requestId = availabilityRequestIdRef.current + 1;
    availabilityRequestIdRef.current = requestId;

    setAvailabilityLoading(true);
    setAvailabilityError(null);
    try {
      const result = await ref.api.loadAvailability(dataSourceKey);
      if (requestId !== availabilityRequestIdRef.current) return;
      setAvailability(result);
    } catch (e) {
      if (requestId !== availabilityRequestIdRef.current) return;
      const err = e instanceof Error ? e : new Error(String(e));
      setAvailabilityError(err);
      setAvailability(null);
    } finally {
      if (requestId === availabilityRequestIdRef.current) {
        setAvailabilityLoading(false);
      }
    }
  }, [dataSourceKey]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    if (!availabilityError) return;
    if (/openstreetmap/i.test(availabilityError.message)) {
      enqueueSnackbar(availabilityError.message, { variant: 'error' });
      return;
    }
    enqueueSnackbar(
      'Failed to load data source availability. Falling back to bundled metadata.',
      { variant: 'warning' },
    );
  }, [availabilityError, enqueueSnackbar]);

  const isoContinentByCode = useMemo(() => {
    if (iso.status !== 'ready') return new Map<string, ContinentCode>();
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
    if (!selectedArrayByCountries) return {};
    if (Array.isArray(selectedArrayByCountries)) {
      const legacy = selectedArrayByCountries as boolean[][];
      const mapped: Record<string, boolean[]> = {};
      baseCountries.forEach((entry, rowIndex) => {
        const row = legacy[rowIndex] ?? [];
        mapped[entry.country.code] = Array.from({ length: resolvedMaxAdminLevel + 1 }, (_, idx) => Boolean(row[idx]));
      });
      return mapped;
    }
    const resolveSelectionKey = (code: string) => {
      const normalized = code.trim().toUpperCase();
      if (normalized.length === 2) return normalized;
      return iso3ToIso2.get(normalized) ?? normalized;
    };
    return Object.fromEntries(
      Object.entries(selectedArrayByCountries).map(([code, row]) => [
        resolveSelectionKey(code),
        Array.isArray(row)
          ? Array.from({ length: resolvedMaxAdminLevel + 1 }, (_, idx) => Boolean(row[idx]))
          : Array.from({ length: resolvedMaxAdminLevel + 1 }, () => false),
      ]),
    );
  }, [baseCountries, iso3ToIso2, resolvedMaxAdminLevel, selectedArrayByCountries]);

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
    if (baseCountries.length === 0) return;
    const nextSelection: Record<string, boolean[]> = {};
    baseCountries.forEach((entry) => {
      const row = normalizedSelection[entry.country.code] ?? [];
      nextSelection[entry.country.code] = Array.from({ length: resolvedMaxAdminLevel + 1 }, (_, colIndex) => (
        entry.availableAdminLevels.includes(colIndex) ? Boolean(row[colIndex]) : false
      ));
    });
    if (!isSelectionEqual(normalizedSelection, nextSelection)) {
      onChange({ selectedArrayByCountries: nextSelection });
    }
  }, [
    baseCountries,
    normalizedSelection,
    onChange,
    resolvedMaxAdminLevel,
  ]);

  const columns: MatrixConfig['columns'] = useMemo(
    () =>
      Array.from({ length: resolvedMaxAdminLevel + 1 }, (_, levelIndex) => ({
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
      return {
        countryCode: entry.country.code,
        selections,
      };
    });
  }, [baseCountries, checkboxMatrix, columns]);

  const applySelections = useCallback(
    (nextSelections: MatrixSelection[]) => {
      const nextSelection = baseCountries.reduce<Record<string, boolean[]>>((acc, entry) => {
        const found = nextSelections.find((sel) => sel.countryCode === entry.country.code);
        const row = columns.map((col, idx) => {
          const enabled = entry.availableAdminLevels.includes(idx);
          return enabled ? Boolean(found?.selections?.[col.id]) : false;
        });
        acc[entry.country.code] = row;
        return acc;
      }, {});
      if (!isSelectionEqual(normalizedSelection, nextSelection)) {
        const nodeId = resolveShapeNodeId(data);
        if (nodeId) {
          void clearStagesIfPresent(nodeId, FULL_INVALIDATION_STAGES);
        }
      }
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
    },
    [
      baseCountries,
      columns,
      countries,
      data,
      enqueueSnackbar,
      onChange,
      normalizedSelection,
    ],
  );

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

  const createDefaultSelectionRow = useCallback(
    (levels: number[]) => Array.from({ length: resolvedMaxAdminLevel + 1 }, (_, idx) => levels.includes(idx)),
    [resolvedMaxAdminLevel],
  );

  useEffect(() => {
    if (baseCountries.length === 0) return;
    if (selectedArrayByCountries && !Array.isArray(selectedArrayByCountries)) return;
    const nextSelection: Record<string, boolean[]> = {};
    baseCountries.forEach((entry) => {
      nextSelection[entry.country.code] = createDefaultSelectionRow(entry.availableAdminLevels);
    });
    if (Object.keys(nextSelection).length > 0) {
      onChange({ selectedArrayByCountries: nextSelection });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCountries.length]);

  const reloadAll = useCallback(async () => {
    if (!dataSourceKey) return;
    await invalidateCountrySelectionCaches(dataSourceKey, sharedNodeId);
    await reloadMetadata({ force: true });
    await loadAvailability();
  }, [dataSourceKey, loadAvailability, reloadMetadata, sharedNodeId]);

  const combinedLoading = metadataLoading || (availabilityLoading && !availability);

  return {
    loading: Boolean(dataSourceKey) && combinedLoading,
    error,
    availabilityInfo: availability
      ? {
        source: availability.source,
        fetchedAt: availability.fetchedAt,
      }
      : null,
    matrixConfig,
    countries: baseCountries.map((entry) => entry.country),
    selections: currentSelections,
    applySelections,
    isCellEnabled,
    reloadAll,
  };
};
