import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { LocationGroupItem } from '@hierarchidb/location-api';
import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { TreeNodeData } from '@hierarchidb/tree-api';
import type { Remote } from 'comlink';
import { DEBUG_PREFIX } from './locationMapPreviewConstants.js';
import { formatTimestamp, resolveLocationType } from './locationMapPreviewUtils.js';

const METADATA_COLUMNS_ORDER = [
  'id',
  'pointId',
  'name',
  'type',
  'latitude',
  'longitude',
  'admin0',
  'admin0Code',
  'admin1',
  'admin1Code',
  'admin2',
  'admin2Code',
  'updatedAt',
  'metadata',
] as const;

const buildMetadataRows = (items: LocationGroupItem[]): Array<Record<string, unknown>> => (
  items.map((item) => {
    const data = item.data;
    const rawType = typeof data?.type === 'string' ? data.type : undefined;
    const rawCountryCode = typeof data?.admin0Code === 'string' ? data.admin0Code : undefined;
    const rawCountryName = typeof data?.admin0 === 'string' ? data.admin0 : undefined;
    return {
      id: item.id,
      pointId: data?.pointId,
      name: data?.name,
      type: rawType ? resolveLocationType(rawType) : 'area_centroid',
      latitude: data?.latitude,
      longitude: data?.longitude,
      admin0: rawCountryName,
      admin0Code: rawCountryCode,
      admin1: data?.admin1,
      admin2: data?.admin2,
      admin1Code: data?.admin1Code,
      admin2Code: data?.admin2Code,
      updatedAt: formatTimestamp(item.updatedAt),
      metadata: data?.metadata,
    };
  })
);

export const buildMetadataColumns = (rows: Array<Record<string, unknown>>): string[] => {
  const forcedColumns = new Set(['admin0', 'admin0Code', 'admin1', 'admin1Code', 'admin2', 'admin2Code']);
  const baseColumns = METADATA_COLUMNS_ORDER.filter((col) => (
    forcedColumns.has(col) || rows.some((row) => row[col] != null && row[col] !== '')
  ));
  const extra = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (METADATA_COLUMNS_ORDER.includes(key as typeof METADATA_COLUMNS_ORDER[number])) return;
      if (row[key] == null || row[key] === '') return;
      extra.add(key);
    });
  });
  return [...baseColumns, ...extra];
};

type UseLocationMapPreviewMetadataArgs = {
  nodeId?: NodeId;
  workerApi: Remote<WorkerAPI<TreeNodeData>> | null;
  workerLoading: boolean;
  workerError: Error | null;
  refreshKey?: string | number | null;
};

type RecyclingState = 'none' | 'off' | 'on' | 'partial';

type UseLocationMapPreviewMetadataResult = {
  metadataItems: LocationGroupItem[];
  metadataRows: Array<Record<string, unknown>>;
  metadataLoading: boolean;
  metadataLoadingText: string;
  metadataError?: string;
  selectedMetadataIds: Set<string>;
  handleMetadataSelectionChange: (selected: Set<string | number>) => void;
  recyclingState: RecyclingState;
  handleToggleRecycling: () => Promise<void>;
  metadataById: Map<string, LocationGroupItem>;
};

export const useLocationMapPreviewMetadata = (
  args: UseLocationMapPreviewMetadataArgs,
): UseLocationMapPreviewMetadataResult => {
  const {
    nodeId,
    workerApi,
    workerLoading,
    workerError,
    refreshKey,
  } = args;

  const [metadataRows, setMetadataRows] = useState<Array<Record<string, unknown>>>([]);
  const [metadataItems, setMetadataItems] = useState<LocationGroupItem[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataLoadingText, setMetadataLoadingText] = useState('Preparing metadata...');
  const [selectedMetadataIds, setSelectedMetadataIds] = useState<Set<string>>(new Set());
  const [metadataError, setMetadataError] = useState<string | undefined>();
  const metadataRequestRef = useRef(0);
  const workerApiRef = useRef(workerApi);
  const workerReady = !workerLoading && !workerError && Boolean(workerApi);

  useEffect(() => {
    workerApiRef.current = workerApi;
  }, [workerApi]);

  const handleMetadataSelectionChange = useCallback((selected: Set<string | number>) => {
    const next = new Set<string>();
    selected.forEach((value) => { next.add(String(value)); });
    setSelectedMetadataIds(next);
  }, []);

  const isMetadataRecycling = useCallback((item: LocationGroupItem) => {
    const meta = item.data?.metadata;
    if (!meta || typeof meta !== 'object') return false;
    return (meta as Record<string, unknown>).recycling === 'true';
  }, []);

  const recyclingState = useMemo<RecyclingState>(() => {
    if (selectedMetadataIds.size === 0) return 'none';
    const selectedItems = metadataItems.filter((item) => selectedMetadataIds.has(String(item.id)));
    if (selectedItems.length === 0) return 'none';
    const recyclingCount = selectedItems.filter(isMetadataRecycling).length;
    if (recyclingCount === 0) return 'off';
    if (recyclingCount === selectedItems.length) return 'on';
    return 'partial';
  }, [isMetadataRecycling, metadataItems, selectedMetadataIds]);

  const handleToggleRecycling = useCallback(async () => {
    if (!nodeId) return;
    if (selectedMetadataIds.size === 0) return;
    if (!workerReady) {
      setMetadataError(
        workerError
          ? `Worker error: ${workerError.message}`
          : 'Worker is not ready. Please wait for worker initialization.',
      );
      return;
    }
    type LocationGroupItemWithData = LocationGroupItem & { data: NonNullable<LocationGroupItem['data']> };
    const selectedItems = metadataItems.filter(
      (item): item is LocationGroupItemWithData => (
        selectedMetadataIds.has(String(item.id)) && item.data?.schemaVersion === 2
      )
    );
    if (selectedItems.length === 0) return;
    const nextValue = selectedItems.length;
    const updatedItems: LocationGroupItem[] = selectedItems.map((item) => ({
      ...item,
      data: {
        ...item.data,
        metadata: {
          ...((item.data?.metadata ?? {}) as Record<string, unknown>),
          recycling: nextValue ? 'true' : 'false',
        },
      },
    }));
    const activeWorkerApi = workerApiRef.current;
    if (!activeWorkerApi) {
      setMetadataError('Worker API is unavailable. Please retry.');
      return;
    }
    const api = await activeWorkerApi.getLocationMutationAPI();
    await api.upsertLocationGroups(nodeId, updatedItems);
    const updatedMap = new Map(updatedItems.map((item) => [String(item.id), item]));
    const nextItems: LocationGroupItem[] = metadataItems.map((item) => updatedMap.get(String(item.id)) ?? item);
    setMetadataItems(nextItems);
    setMetadataRows(buildMetadataRows(nextItems));
  }, [
    metadataItems,
    nodeId,
    selectedMetadataIds,
    workerError,
    workerReady,
  ]);

  useEffect(() => {
    if (!nodeId) {
      setMetadataRows([]);
      setMetadataItems([]);
      setMetadataLoading(false);
      setMetadataError(undefined);
      return;
    }
    let cancelled = false;
    const requestId = ++metadataRequestRef.current;
    console.info(DEBUG_PREFIX, 'metadata-fetch:start', { nodeId });
    setMetadataLoading(true);
    setMetadataError(undefined);

    if (workerError) {
      setMetadataLoading(false);
      setMetadataError(`Worker error: ${workerError.message}`);
      return () => {
        cancelled = true;
      };
    }
    if (!workerReady) {
      setMetadataLoadingText('Waiting for worker connection...');
      return () => {
        cancelled = true;
      };
    }

    const run = async () => {
      try {
        setMetadataLoadingText('Initializing worker...');
        const activeWorkerApi = workerApiRef.current;
        if (!activeWorkerApi) {
          throw new Error('Worker API is unavailable');
        }
        setMetadataLoadingText('Fetching metadata from worker...');
        const api = await activeWorkerApi.getLocationQueryAPI();
        const items = await api.listLocationGroups(nodeId);
        if (cancelled || requestId !== metadataRequestRef.current) return;
        console.info(DEBUG_PREFIX, 'metadata-fetch:success', { nodeId, count: items.length });
        setMetadataLoadingText('Preparing metadata rows...');
        const rows = buildMetadataRows(items);
        setMetadataItems(items);
        setMetadataRows(rows);
        setMetadataLoading(false);
      } catch (error) {
        if (cancelled || requestId !== metadataRequestRef.current) return;
        const message = error instanceof Error ? error.message : String(error);
        console.error(DEBUG_PREFIX, 'metadata-fetch:error', { nodeId, message });
        setMetadataItems([]);
        setMetadataRows([]);
        setMetadataLoading(false);
        setMetadataError(`Metadata fetch failed: ${message}`);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [nodeId, refreshKey, workerError, workerReady]);

  const metadataById = useMemo(
    () => new Map(metadataItems.map((item) => [String(item.id), item])),
    [metadataItems],
  );

  return {
    metadataItems,
    metadataRows,
    metadataLoading,
    metadataLoadingText,
    metadataError,
    selectedMetadataIds,
    handleMetadataSelectionChange,
    recyclingState,
    handleToggleRecycling,
    metadataById,
  };
};
