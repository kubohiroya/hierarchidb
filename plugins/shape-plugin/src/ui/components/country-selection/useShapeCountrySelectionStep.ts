import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useIsoCountries, type MatrixConfig, type MatrixSelection, type ContinentCode } from '@hierarchidb/ui-country-select';
import type { CountryMetadata, ShapeEntity } from '../../../common/types/index.js';
import {
  calculateEstimatedFeatures,
  calculateEstimatedSize,
  formatBytes,
  formatNumber,
} from '../../../common/utils/estimates.js';
import { isDataSourceName, SHAPE_DATA_SOURCE_BY_NAME } from '../../../common/types/index.js';
import type { CountryAvailabilityWorkerAPI, SerializedCountryAvailability } from '../../workers/countryAvailability.types.js';
import { wrap, releaseProxy, proxy } from 'comlink';
import type { NodeId } from '@hierarchidb/core-types';
import { useDialogContext } from '@hierarchidb/ui-dialog';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { NobleSha3HashPort } from '@hierarchidb/chunk-store';
import { hidbEphemeralDB as ephemeralShapeDB } from '@hierarchidb/gis-sdk';
import { deleteRawDataDataSourceBuffersForNodeKeys } from '../../../services/utils/chunkStore.ts';
import { shapeMutationAPIImpl } from '../../../services/batch/ShapeBuildAPIClient.ts';
import { sanitizeShapeDraftData } from '../../utils/sanitizeShapeDraftData.ts';

// (availability is loaded in a dedicated worker thread)

const createAvailabilityWorker = () => new Worker(
  new URL('../../workers/countryAvailability.worker.ts', import.meta.url),
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
  an: 'AN'
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
  nodeId: NodeId;
};

export const useShapeCountrySelectionStep = ({ data, onChange, nodeId: _nodeId }: Args) => {
  const { enqueueSnackbar } = useSnackbar();
  const nodeId = _nodeId;
  const { onStepNavigate } = useDialogContext<Partial<ShapeEntity>>();
  const bridgeRef = useMemo(() => getWorkerBridge(), []);
  const prevSelectionRef = useRef<Record<string, boolean[]> | null>(null);

  // Current selection value must be available before any derived useMemo.
  const selectedArrayByCountries = data.selectedArrayByCountries;

  const { dataSourceKey, dataSourceError } = useMemo(() => {
    const anyData = data as unknown as Record<string, unknown>;
    const hasData = Boolean(
      anyData
      && typeof anyData === 'object'
      && Object.keys(anyData).length > 0
    );

    const draftData = (anyData && typeof anyData === 'object' && 'draftData' in anyData)
      ? (anyData as { draftData?: unknown }).draftData as Record<string, unknown> | undefined
      : undefined;

    const batchConfig = (anyData && typeof anyData === 'object' && 'batchConfig' in anyData)
      ? (anyData as { batchConfig?: unknown }).batchConfig as Record<string, unknown> | undefined
      : undefined;

    const buildConfig = (anyData && typeof anyData === 'object' && 'buildConfig' in anyData)
      ? (anyData as { buildConfig?: unknown }).buildConfig as Record<string, unknown> | undefined
      : undefined;

    const dsFromEntity = isDataSourceName(buildConfig?.dataSourceName) ? buildConfig.dataSourceName : undefined;
    const dsFromBatch = isDataSourceName(batchConfig?.dataSourceName) ? batchConfig.dataSourceName : undefined;

    const dsFromDraft = (() => {
      const bc = draftData?.buildConfig;
      if (!bc || typeof bc !== 'object') return undefined;
      const value = (bc as Record<string, unknown>).dataSourceName;
      return isDataSourceName(value) ? value : undefined;
    })();

    const candidate = dsFromDraft ?? dsFromEntity ?? dsFromBatch;
    const hasBatchConfig =
      (batchConfig && typeof batchConfig === 'object')
      || (draftData?.buildConfig && typeof draftData.buildConfig === 'object');

    if (!candidate) {
      // Don't guess a data source (no implicit fallback to GADM).
      // Surface an error only after data is available.
      if (hasData && hasBatchConfig) {
        console.warn('[shape-plugin][country-selection] dataSource missing', {
          batchConfigKeys: batchConfig ? Object.keys(batchConfig) : null,
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
    if (dataSourceError) {
      onStepNavigate({ type: 'direct', targetIndex: 1 });
    }
  }, [dataSourceError, onStepNavigate]);
  const iso = useIsoCountries();
  const [countries, setCountries] = useState<CountryMetadata[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<Error | null>(null);
  const metadataRequestIdRef = useRef(0);

  const error = dataSourceError ?? metadataError;

  const [availability, setAvailability] = useState<SerializedCountryAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState<Error | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const availabilityWorkerRef = useRef<{
    worker: Worker;
    api: ReturnType<typeof wrap<CountryAvailabilityWorkerAPI>>;
  } | null>(null);
  const availabilityBridgeReadyRef = useRef<Promise<void> | null>(null);
  const availabilityRequestIdRef = useRef(0);

  useEffect(() => {
    const worker = createAvailabilityWorker();
    const api = wrap<CountryAvailabilityWorkerAPI>(worker);
    availabilityBridgeReadyRef.current = api.setUiStorageBridge(
      proxy({
        getItem: async (key: string) => localStorage.getItem(key),
        setItem: async (key: string, value: string) => {
          localStorage.setItem(key, value);
        },
        removeItem: async (key: string) => {
          localStorage.removeItem(key);
        },
      }),
    ).catch((error) => {
      console.warn('[ShapeCountrySelectionStep] failed to register storage bridge', error);
    });
    availabilityWorkerRef.current = { worker, api };
    return () => {
      availabilityWorkerRef.current = null;
      availabilityBridgeReadyRef.current = null;
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
      const bridgeReady = availabilityBridgeReadyRef.current;
      if (!bridgeReady) {
        throw new Error('UI storage bridge is not initialized for availability worker');
      }
      await bridgeReady;
      const result = await ref.api.loadAvailability(dataSourceKey, nodeId);
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
  }, [dataSourceKey, nodeId]);

  const loadMetadata = useCallback(async (options?: { force?: boolean }) => {
    if (!dataSourceKey) {
      setCountries([]);
      setMetadataError(null);
      setMetadataLoading(false);
      return;
    }
    const ref = availabilityWorkerRef.current;
    if (!ref) return;
    const requestId = metadataRequestIdRef.current + 1;
    metadataRequestIdRef.current = requestId;

    setMetadataLoading(true);
    setMetadataError(null);
    try {
      const bridgeReady = availabilityBridgeReadyRef.current;
      if (!bridgeReady) {
        throw new Error('UI storage bridge is not initialized for availability worker');
      }
      await bridgeReady;
      const result = await ref.api.loadMetadata(dataSourceKey, nodeId, options);
      if (requestId !== metadataRequestIdRef.current) return;
      setCountries(Array.isArray(result) ? result : []);
      if (!result?.length) {
        throw new Error(`No country metadata returned for data source: ${dataSourceKey}`);
      }
    } catch (e) {
      if (requestId !== metadataRequestIdRef.current) return;
      const err = e instanceof Error ? e : new Error(String(e));
      setMetadataError(err);
      setCountries([]);
    } finally {
      if (requestId === metadataRequestIdRef.current) {
        setMetadataLoading(false);
      }
    }
  }, [dataSourceKey, nodeId]);

  const loadAll = useCallback(async (options?: { force?: boolean }) => {
    await loadMetadata(options);
    await loadAvailability();
  }, [loadAvailability, loadMetadata]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!availabilityError) return;
    enqueueSnackbar(
      'Failed to load data source availability.',
      { variant: 'error' },
    );
  }, [availabilityError, enqueueSnackbar]);

  useEffect(() => {
    if (!metadataError) return;
    enqueueSnackbar(metadataError.message, { variant: 'error' });
  }, [metadataError, enqueueSnackbar]);

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
    if (Array.isArray(selectedArrayByCountries)) return {};
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

  const buildSelectionSet = useCallback((selection: Record<string, boolean[]>): Set<string> => {
    const set = new Set<string>();
    Object.entries(selection).forEach(([code, row]) => {
      row.forEach((selected, index) => {
        if (selected) {
          set.add(`${code}:${index}`);
        }
      });
    });
    return set;
  }, []);

  const invalidateBuildForSelectionChange = useCallback(async (
    prevSelection: Record<string, boolean[]>,
    nextSelection: Record<string, boolean[]>,
  ) => {
    if (!nodeId) return;
    const prevSet = buildSelectionSet(prevSelection);
    const nextSet = buildSelectionSet(nextSelection);
    const removed = Array.from(prevSet).filter((entry) => !nextSet.has(entry));
    if (removed.length === 0) return;
    const removedPairs = removed.map((entry) => {
      const [countryCode, adminLevelText] = entry.split(':');
      return {
        countryCode: countryCode ?? '',
        adminLevel: Number.parseInt(adminLevelText ?? '', 10),
      };
    }).filter((entry) => entry.countryCode && Number.isFinite(entry.adminLevel));
    if (removedPairs.length === 0) return;
    const taskQueue = new VtTaskQueueDb();
    const removedKeyTuples = removedPairs.map((entry) => (
      [nodeId, entry.countryCode, entry.adminLevel] as const
    ));
    const [fetchCaches, transformCaches, vtTasks] = await Promise.all([
      ephemeralShapeDB.fetchCache
        .where('[nodeId+countryCode+adminLevel]')
        .anyOf(removedKeyTuples)
        .toArray(),
      ephemeralShapeDB.transformCache
        .where('[nodeId+countryCode+adminLevel]')
        .anyOf(removedKeyTuples)
        .toArray(),
      taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, 'vt']).toArray(),
    ]);
    const fetchCacheIds = fetchCaches.map((cache) => cache.id);
    const transformCacheIds = transformCaches.map((cache) => cache.id);
    if (fetchCacheIds.length > 0) {
      await ephemeralShapeDB.fetchCache
        .where('[nodeId+countryCode+adminLevel]')
        .anyOf(removedKeyTuples)
        .delete();
      await deleteRawDataDataSourceBuffersForNodeKeys(nodeId, fetchCacheIds);
    }
    const removedBufferSet = new Set(transformCacheIds);
    if (transformCacheIds.length > 0) {
      await ephemeralShapeDB.transformCache
        .where('[nodeId+countryCode+adminLevel]')
        .anyOf(removedKeyTuples)
        .delete();
      const relations = await ephemeralShapeDB.tileIdToBufferRelations
        .where('bufferId')
        .anyOf(transformCacheIds)
        .toArray();
      const affectedTileIds = new Set(relations.map((row) => row.tileId));
      await ephemeralShapeDB.tileIdToBufferRelations
        .where('bufferId')
        .anyOf(transformCacheIds)
        .delete();
      const encoder = new TextEncoder();
      const hasher = new NobleSha3HashPort();
      const tileIdsToDelete = vtTasks
        .map((task) => {
          const input = task.inputData as { bufferIds?: string[]; tileId?: number } | undefined;
          if (!input?.bufferIds?.length || typeof input.tileId !== 'number') return null;
          if (!input.bufferIds.some((bufferId) => removedBufferSet.has(bufferId))) return null;
          const sorted = [...input.bufferIds].sort();
          const hash = hasher.digest(encoder.encode(JSON.stringify(sorted)).buffer, 'sha3-256');
          return `${input.tileId}|${hash}`;
        })
        .filter((entry): entry is string => Boolean(entry));
      for (const tileId of tileIdsToDelete) {
        await shapeMutationAPIImpl.deleteVectorTile(tileId);
      }
      if (affectedTileIds.size > 0 && tileIdsToDelete.length === 0) {
        await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
      }
    }
    const tasks = await taskQueue.tasks.where('nodeId').equals(nodeId).toArray();
    const removedSet = new Set(removed.map((entry) => entry.toUpperCase()));
    const removedTaskIds = tasks
      .filter((task) => {
        if (task.stage === 'fetch' || task.stage === 'transform') {
          const input = task.inputData as { countryCode?: string; adminLevel?: number } | undefined;
          if (!input?.countryCode || typeof input.adminLevel !== 'number') return false;
          return removedSet.has(`${input.countryCode.toUpperCase()}:${input.adminLevel}`);
        }
        if (task.stage === 'vt') {
          const input = task.inputData as { bufferIds?: string[] } | undefined;
          if (!input?.bufferIds?.length) return false;
          return input.bufferIds.some((bufferId) => removedBufferSet.has(bufferId));
        }
        return false;
      })
      .map((task) => task.taskId);
    if (removedTaskIds.length > 0) {
      await taskQueue.tasks.bulkDelete(removedTaskIds);
    }
    try {
      await bridgeRef.initialize();
      const updater = await bridgeRef.getTreeNodeUpdaterAPI();
      await updater.updateTreeNode(nodeId, {
        mode: 'save-draft',
        draftData: {
          ...sanitizeShapeDraftData(data ?? {}),
          selectedArrayByCountries: nextSelection,
          processingStatus: 'idle',
          buildStartedAt: undefined,
          buildFinishedAt: undefined,
          buildElapsedMs: 0,
          buildResumedAt: undefined,
          stageElapsedMs: 0,
          stageResumedAt: undefined,
          stageElapsedStageId: undefined,
          stageElapsedByStage: {},
        } as Record<string, unknown>,
      });
    } catch (error) {
      console.warn('[ShapeCountrySelectionStep] failed to invalidate build after selection change', error);
    }
  }, [bridgeRef, buildSelectionSet, data, nodeId]);

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
    void invalidateBuildForSelectionChange(prev, normalizedSelection);
  }, [invalidateBuildForSelectionChange, nodeId, normalizedSelection]);

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

  const countryList = useMemo(() => baseCountries.map((entry) => entry.country), [baseCountries]);

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
      enqueueSnackbar,
      onChange,
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

  const reloadAll = useCallback(async () => {
    if (!dataSourceKey) return;
    await loadAll({ force: true });
  }, [dataSourceKey, loadAll]);

  const combinedLoading = metadataLoading || (availabilityLoading && !availability);

  if (!dataSourceKey) {
    return {
      loading: true,
      error: null,
      availabilityInfo: null,
      matrixConfig: { columns: [], virtualization: { rowHeight: 40, overscan: 8 } },
      countries: [],
      selections: [],
      applySelections: () => {},
      isCellEnabled: () => false,
      reloadAll: async () => {},
    };
  }

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
    countries: countryList,
    selections: currentSelections,
    applySelections,
    isCellEnabled,
    reloadAll,
  };
};
