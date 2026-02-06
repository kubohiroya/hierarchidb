import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type DataSourceSelectionOption,
  type IdeGsmFileEntry,
  type IdeGsmImportLabels,
  type IdeGsmImportPayload,
} from '@hierarchidb/ui-datasource';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import type { LocationDataSource, LocationEntity, LocationType } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import type { NodeId } from '@hierarchidb/core-types';
import { createLocationTabularApi } from '../../../common/tabular/createLocationTabularApi.js';

const ORDERED_DATA_SOURCES: LocationDataSource[] = [
  'ide-gsm',
  'openstreetmap',
  'overpass',
  'geonames',
  'wikidata',
  'ourairports',
  'openflights',
  'world-port-index',
  'natural-earth',
  'custom',
  'manual',
];

const LICENSE_DETAILS: Record<
  LocationDataSource,
  { licenseName: string; licenseUrl?: string; attribution?: string }
> = {
  openstreetmap: {
    licenseName: 'ODbL 1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
    attribution: '© OpenStreetMap contributors',
  },
  overpass: {
    licenseName: 'ODbL 1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
    attribution: '© OpenStreetMap contributors',
  },
  geonames: {
    licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Data provided by GeoNames',
  },
  wikidata: {
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution: 'Data from Wikidata contributors',
  },
  ourairports: {
    licenseName: 'Public Domain',
    licenseUrl: 'https://ourairports.com/data/',
    attribution: 'Data courtesy of OurAirports.com',
  },
  openflights: {
    licenseName: 'ODbL 1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
    attribution: 'OpenFlights project',
  },
  'world-port-index': {
    licenseName: 'Public Domain',
    licenseUrl: 'https://msi.nga.mil/Publications/WPI',
    attribution: 'World Port Index (U.S. National Geospatial-Intelligence Agency)',
  },
  'natural-earth': {
    licenseName: 'Public Domain',
    licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
    attribution: 'Map data by Natural Earth',
  },
  'ide-gsm': {
    licenseName: 'IDE-GSM License',
    licenseUrl: undefined,
    attribution: undefined,
  },
  custom: {
    licenseName: 'Custom terms',
    licenseUrl: undefined,
    attribution: undefined,
  },
  manual: {
    licenseName: 'User provided',
    licenseUrl: undefined,
    attribution: undefined,
  },
};

const SOURCE_DESCRIPTIONS: Record<LocationDataSource, string> = {
  openstreetmap: 'OpenStreetMap default pipeline for general points',
  overpass: 'OpenStreetMap Overpass API for custom queries',
  geonames: 'GeoNames worldwide place names with population attributes',
  wikidata: 'Wikidata places and facilities (community maintained)',
  ourairports: 'OurAirports global airport database (public domain)',
  openflights: 'OpenFlights airport dataset with IATA/ICAO codes',
  'world-port-index': 'World Port Index (NGA) major ports worldwide',
  'natural-earth': 'Natural Earth populated places and transport hubs',
  'ide-gsm': 'IDE-GSM schema represents city data',
  custom: 'Upload your own tabular dataset',
  manual: 'Enter locations manually',
};

const TYPE_ICONS: Record<string, string> = {
  area_centroid: '🎯',
  airport: '✈️',
  port: '🚢',
  railway_station: '🚉',
  interchange: '🛣️',
};

const SOURCE_TYPES: Partial<Record<LocationDataSource, LocationType[]>> = {
  openstreetmap: ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
  overpass: ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
  geonames: ['area_centroid', 'airport', 'port'],
  wikidata: ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
  ourairports: ['airport'],
  openflights: ['airport'],
  'world-port-index': ['port'],
  'natural-earth': ['area_centroid', 'airport', 'port'],
  'ide-gsm': ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
};

const DISABLED_SOURCES: LocationDataSource[] = ORDERED_DATA_SOURCES.filter(
  (sourceId) => sourceId !== 'ide-gsm',
);

const HIDDEN_SOURCES: LocationDataSource[] = ['custom', 'manual'];

const ensureTabularXlsx = async (): Promise<void> => {
  await import('@hierarchidb/tabular-source-xlsx');
};

const decodeDataUrlToFile = (dataUrl: string, filename: string): File | null => {
  if (!dataUrl.startsWith('data:')) return null;
  const [header, payload] = dataUrl.split(',');
  if (!header || payload === undefined) return null;
  const match = /^data:(.*?)(;base64)?$/.exec(header);
  const mime = match?.[1] || 'application/octet-stream';
  const isBase64 = Boolean(match?.[2]);
  try {
    const data = isBase64 ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i += 1) {
      bytes[i] = data.charCodeAt(i);
    }
    return new File([bytes], filename, { type: mime });
  } catch {
    return null;
  }
};

export type IdeGsmPanelConfig = {
  files: IdeGsmFileEntry[];
  labels: IdeGsmImportLabels;
  defaultDownloadUrl?: string;
  disabled?: boolean;
  onAddFile: (payload: IdeGsmImportPayload) => void;
  onRemoveFile: (index: number) => void;
};

export const useLocationDataSourceStep = ({
  draft,
  onUpdate,
  disabled,
  nodeId,
}: {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
  disabled?: boolean;
  nodeId?: NodeId;
}) => {
  const { t } = useTranslation();
  const { api, initialize } = useWorkerAPI();
  const tabularApi = useMemo(() => createLocationTabularApi(), []);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);
  const [pendingRemoveKey, setPendingRemoveKey] = useState<string | null>(null);
  const [routeRefCount, setRouteRefCount] = useState<number | null>(null);
  const [routeRefLoading, setRouteRefLoading] = useState(false);
  const [routeRefError, setRouteRefError] = useState<string | null>(null);
  const [removeInProgress, setRemoveInProgress] = useState(false);
  const [importInProgress, setImportInProgress] = useState(false);

  const value = useMemo<LocationDataSource>(
    () => (draft.dataSource as LocationDataSource) ?? 'openstreetmap',
    [draft.dataSource]
  );

  const baseOptions = useMemo<DataSourceSelectionOption[]>(
    () =>
      ORDERED_DATA_SOURCES.filter((sourceId) => !HIDDEN_SOURCES.includes(sourceId)).map((sourceId) => {
        const license = LICENSE_DETAILS[sourceId];
        return {
          id: sourceId,
          name: t(`dataSource.options.${sourceId}.name`, sourceId),
          description: SOURCE_DESCRIPTIONS[sourceId],
          licenseName: license?.licenseName ?? 'License',
          licenseUrl: license?.licenseUrl,
          attribution: license?.attribution,
          disabled: DISABLED_SOURCES.includes(sourceId),
        };
      }),
    [t]
  );

  const description = t('dataSource.description', 'Choose a dataset source to fetch location data.');
  const ideGsmLabels = useMemo(
    () => ({
      importButton: t('dataSource.ideGsm.importButton', 'Import'),
      noFiles: t('dataSource.ideGsm.noFiles', 'No files imported.'),
      importLocal: t('dataSource.ideGsm.importLocal', 'Import Local Files'),
      importRemote: t('dataSource.ideGsm.importRemote', 'Import Remote Files'),
      fileFallback: t('dataSource.ideGsm.fileFallback', 'Imported file'),
      removeFile: t('dataSource.ideGsm.removeFile', 'Remove imported file'),
      buttonLabel: t('dataSource.ideGsm.buttonLabel', 'Select IDE-GSM file'),
      instructions: t(
        'dataSource.ideGsm.instructions',
        'Provide an IDE-GSM CSV file via upload or URL.',
      ),
    }),
    [t],
  );

  const ideGsmSources = useMemo<IdeGsmFileEntry[]>(() => {
    if (draft.ideGsmSources && draft.ideGsmSources.length > 0) {
      return draft.ideGsmSources.map((entry) => ({
        fileName: entry.fileName,
        sourceId: entry.tabularSourceId,
        sizeBytes: entry.sizeBytes,
        sourceType: entry.sourceType ?? 'local',
      }));
    }
    if (draft.tabularSourceId) {
      const sizeBytes = typeof draft.ideGsmFileSizeBytes === 'number' ? draft.ideGsmFileSizeBytes : undefined;
      return [{
        fileName: draft.ideGsmFileName ?? t('dataSource.ideGsm.fileFallback', 'Imported file'),
        sourceId: draft.tabularSourceId,
        sizeBytes,
        sourceType: 'local',
      }];
    }
    return [];
  }, [draft.ideGsmFileName, draft.ideGsmFileSizeBytes, draft.ideGsmSources, draft.tabularSourceId, t]);

  const buildEntryKey = useCallback((entry: IdeGsmFileEntry): string => (
    `${entry.sourceId || ''}::${entry.fileName}`
  ), []);
  const buildSourceKey = useCallback((sources: IdeGsmFileEntry[]): string => (
    sources
      .map((entry) => buildEntryKey(entry))
      .join('|')
  ), [buildEntryKey]);
  const [visibleSources, setVisibleSources] = useState<IdeGsmFileEntry[]>(ideGsmSources);
  const [visibleSourceKey, setVisibleSourceKey] = useState<string>(() => buildSourceKey(ideGsmSources));
  const pendingDraftKeyRef = useRef<string | null>(null);
  const stableSourcesRef = useRef<IdeGsmFileEntry[]>(ideGsmSources);
  const sourceKey = useMemo(() => buildSourceKey(ideGsmSources), [buildSourceKey, ideGsmSources]);

  useEffect(() => {
    if (!draft.ideGsmSourceUrl) return;
    if (draft.tabularSourceId) return;
    if (draft.ideGsmSources && draft.ideGsmSources.length > 0) return;
    if (importInProgress) return;
    let cancelled = false;
    const migrate = async () => {
      setImportInProgress(true);
      try {
        await ensureTabularXlsx();
        const fallbackName = draft.ideGsmFileName ?? t('dataSource.ideGsm.fileFallback', 'Imported file');
        const dataUrlFile = decodeDataUrlToFile(draft.ideGsmSourceUrl ?? '', fallbackName);
        const metadata = dataUrlFile
          ? await tabularApi.uploadTabularFile(dataUrlFile, {})
          : await tabularApi.downloadTabularFromUrl(draft.ideGsmSourceUrl ?? '', {}, nodeId);
        if (cancelled || !metadata) return;
        const entry: IdeGsmFileEntry = {
          fileName: metadata.filename ?? fallbackName,
          sourceId: metadata.id,
          sizeBytes: metadata.fileSizeBytes ?? dataUrlFile?.size,
          sourceType: dataUrlFile ? 'local' : 'remote',
        };
        onUpdate({
          ideGsmSources: [{
            fileName: entry.fileName,
            tabularSourceId: entry.sourceId,
            sizeBytes: entry.sizeBytes,
            sourceType: entry.sourceType,
          }],
          ideGsmFileName: entry.fileName,
          ideGsmFileSizeBytes: entry.sizeBytes,
          tabularSourceId: entry.sourceId,
          ideGsmSourceUrl: undefined,
          ideGsmSelectionHash: undefined,
          selectedArrayByCountries: {},
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[LocationDataSourceStep] failed to migrate legacy IDE-GSM source', message);
      } finally {
        if (!cancelled) {
          setImportInProgress(false);
        }
      }
    };
    void migrate();
    return () => {
      cancelled = true;
    };
  }, [
    draft.ideGsmFileName,
    draft.ideGsmSourceUrl,
    draft.ideGsmSources,
    draft.tabularSourceId,
    importInProgress,
    nodeId,
    onUpdate,
    t,
    tabularApi,
  ]);

  useEffect(() => {
    if (removeDialogOpen || pendingRemoveKey) return;
    if (pendingDraftKeyRef.current !== null) {
      if (sourceKey === pendingDraftKeyRef.current) {
        pendingDraftKeyRef.current = null;
      } else {
        return;
      }
    }
    if (sourceKey === visibleSourceKey) return;
    setVisibleSources(ideGsmSources);
    setVisibleSourceKey(sourceKey);
  }, [ideGsmSources, sourceKey, visibleSourceKey, removeDialogOpen, pendingRemoveKey]);

  useEffect(() => {
    if (removeDialogOpen || pendingRemoveKey || removeInProgress) return;
    stableSourcesRef.current = visibleSources;
  }, [removeDialogOpen, pendingRemoveKey, removeInProgress, visibleSources]);

  const displaySources = removeDialogOpen ? stableSourcesRef.current : visibleSources;

  const handleAddFile = useCallback(async (payload: IdeGsmImportPayload) => {
    if (importInProgress) return;
    setImportInProgress(true);
    try {
      await ensureTabularXlsx();
      const metadata = await tabularApi.uploadTabularFile(payload.file, {});
      const entry: IdeGsmFileEntry = {
        fileName: metadata.filename ?? payload.file.name,
        sourceId: metadata.id,
        sizeBytes: metadata.fileSizeBytes ?? payload.file.size,
        sourceType: payload.sourceType,
      };
      if (displaySources.some((source) => source.sourceId === entry.sourceId)) {
        return;
      }
      const nextSources = [...displaySources, entry];
      const primary = nextSources[nextSources.length - 1];
      const nextKey = buildSourceKey(nextSources);
      pendingDraftKeyRef.current = nextKey;
      setVisibleSources(nextSources);
      setVisibleSourceKey(nextKey);
      onUpdate({
        ideGsmSources: nextSources.map((source) => ({
          fileName: source.fileName,
          tabularSourceId: source.sourceId,
          sizeBytes: source.sizeBytes,
          sourceType: source.sourceType,
        })),
        ideGsmFileName: primary?.fileName,
        ideGsmFileSizeBytes: primary?.sizeBytes,
        tabularSourceId: primary?.sourceId,
        selectedArrayByCountries: {},
        ideGsmSelectionHash: undefined,
        ideGsmSourceUrl: undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[LocationDataSourceStep] failed to import IDE-GSM file', message);
    } finally {
      setImportInProgress(false);
    }
  }, [buildSourceKey, displaySources, importInProgress, onUpdate, tabularApi]);

  const requestRemoveFile = useCallback((index: number) => {
    const entry = displaySources[index];
    if (!entry) return;
    const entryKey = buildEntryKey(entry);
    setPendingRemoveIndex(index);
    setPendingRemoveKey(entryKey);
    setRemoveDialogOpen(true);
    setRouteRefCount(null);
    setRouteRefError(null);
  }, [buildEntryKey, displaySources]);

  const handleRemoveFile = useCallback((index: number) => {
    requestRemoveFile(index);
  }, [requestRemoveFile]);

  const ideGsmOptionMeta: IdeGsmPanelConfig = useMemo(() => ({
    files: displaySources,
    labels: ideGsmLabels,
    defaultDownloadUrl: undefined,
    disabled: Boolean(disabled) || removeInProgress || importInProgress,
    onAddFile: handleAddFile,
    onRemoveFile: handleRemoveFile,
  }), [displaySources, ideGsmLabels, disabled, removeInProgress, importInProgress, handleAddFile, handleRemoveFile]);

  const resolvedOptions = useMemo<DataSourceSelectionOption[]>(
    () => baseOptions.map((option) =>
      option.id === 'ide-gsm'
        ? { ...option, metadata: { ideGsmPanel: ideGsmOptionMeta } }
        : option
    ),
    [baseOptions, ideGsmOptionMeta]
  );

  useEffect(() => {
    if (!removeDialogOpen || pendingRemoveIndex == null) return;
    if (!api || !nodeId) return;
    let cancelled = false;
    const fetchRouteRefCount = async () => {
      setRouteRefLoading(true);
      try {
        await initialize();
        const routeQuery = await api.getRouteQueryAPI();
        const count = await routeQuery.countRouteReferencesToLocations([nodeId]);
        if (!cancelled) {
          setRouteRefCount(count);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          setRouteRefError(message);
        }
      } finally {
        if (!cancelled) {
          setRouteRefLoading(false);
        }
      }
    };
    void fetchRouteRefCount();
    return () => {
      cancelled = true;
    };
  }, [api, initialize, nodeId, pendingRemoveIndex, removeDialogOpen]);

  const confirmRemoveFile = async () => {
    const resolvedIndex = pendingRemoveIndex;
    const resolvedKey = pendingRemoveKey;
    if (resolvedIndex == null || !resolvedKey) return;
    setRemoveInProgress(true);
    const previousSources = ideGsmSources;
    let removed = false;
    const nextSources = previousSources.filter((entry, idx) => {
      if (removed) return true;
      if (idx === resolvedIndex) {
        removed = true;
        return false;
      }
      if (buildEntryKey(entry) === resolvedKey) {
        removed = true;
        return false;
      }
      return true;
    });
    const primary = nextSources[nextSources.length - 1];
    const nextKey = buildSourceKey(nextSources);
    pendingDraftKeyRef.current = nextKey;
    setVisibleSources(nextSources);
    setVisibleSourceKey(nextKey);
    const nextDraftPayload: Partial<LocationEntity> = {
      ...(draft as Partial<LocationEntity>),
      ideGsmSources: nextSources.map((source) => ({
        fileName: source.fileName,
        tabularSourceId: source.sourceId,
        sizeBytes: source.sizeBytes,
        sourceType: source.sourceType,
      })),
      ideGsmFileName: primary?.fileName ?? '',
      ideGsmFileSizeBytes: primary?.sizeBytes ?? undefined,
      tabularSourceId: primary?.sourceId ?? undefined,
      ideGsmSourceUrl: undefined,
      ...(nextSources.length > 0 ? {} : { selectedArrayByCountries: {} }),
      ideGsmSelectionHash: undefined,
      ...(nextSources.length > 0
        ? { processingStatus: 'pending' }
        : { processingStatus: undefined, processedAt: undefined, lastProcessedAt: undefined }),
    };
    if ('draftMetadata' in nextDraftPayload) {
      delete nextDraftPayload.draftMetadata;
    }
    if (api && nodeId) {
      try {
        await initialize();
        const locationMutation = await api.getLocationMutationAPI();
        const removedEntry = previousSources.find((entry) => buildEntryKey(entry) === resolvedKey) ?? previousSources[resolvedIndex];
        if (removedEntry?.sourceId) {
          await locationMutation.deleteLocationBySourceKey(nodeId, removedEntry.sourceId);
          await tabularApi.removeTableReference(removedEntry.sourceId, 'location');
        }
        const updaterAPI = await api.getTreeNodeUpdaterAPI();
        await updaterAPI.updateTreeNodeDraftData(nodeId, nextDraftPayload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setRouteRefError(message);
        pendingDraftKeyRef.current = null;
        setVisibleSources(previousSources);
        setVisibleSourceKey(buildSourceKey(previousSources));
        setRemoveInProgress(false);
        return;
      }
    }
    const hasSources = nextSources.length > 0;
    onUpdate({
      ideGsmSources: nextSources.map((source) => ({
        fileName: source.fileName,
        tabularSourceId: source.sourceId,
        sizeBytes: source.sizeBytes,
        sourceType: source.sourceType,
      })),
      ideGsmFileName: primary?.fileName ?? '',
      ideGsmFileSizeBytes: primary?.sizeBytes ?? undefined,
      tabularSourceId: primary?.sourceId ?? undefined,
      ideGsmSourceUrl: undefined,
      ...(hasSources ? {} : { selectedArrayByCountries: {} }),
      ideGsmSelectionHash: undefined,
      ...(hasSources
        ? { processingStatus: 'pending' }
        : { processingStatus: undefined, processedAt: undefined, lastProcessedAt: undefined }),
    });
    setRemoveDialogOpen(false);
    setPendingRemoveIndex(null);
    setPendingRemoveKey(null);
    setRemoveInProgress(false);
  };

  const handleSelectionChange = useCallback((next: { dataSourceId?: string; licenseAgreement?: boolean; licenseAgreedAt?: number }) => {
    const nextSource = (next.dataSourceId as LocationDataSource | undefined) ?? value;
    const sourceChanged = nextSource !== value;
    onUpdate({
      dataSource: nextSource,
      licenseAgreement: next.licenseAgreement,
      licenseAgreedAt: next.licenseAgreedAt,
      ideGsmFileName: nextSource === 'ide-gsm' ? draft.ideGsmFileName : undefined,
      ideGsmSources: nextSource === 'ide-gsm' ? draft.ideGsmSources : undefined,
      ideGsmFileSizeBytes: nextSource === 'ide-gsm' ? draft.ideGsmFileSizeBytes : undefined,
      tabularSourceId: nextSource === 'ide-gsm' ? draft.tabularSourceId : undefined,
      ...(sourceChanged
        ? { selectedArrayByCountries: {}, ideGsmSelectionHash: undefined }
        : {}),
    });
  }, [draft.ideGsmFileName, draft.ideGsmFileSizeBytes, draft.ideGsmSources, draft.tabularSourceId, onUpdate, value]);

  const getSupportedIcons = useCallback((sourceId: LocationDataSource) => {
    const supported = SOURCE_TYPES[sourceId] ?? SOURCE_TYPES.openstreetmap ?? [];
    return supported
      .map((type) => TYPE_ICONS[type] ?? '')
      .filter(Boolean)
      .join(' ');
  }, []);

  return {
    t,
    value,
    description,
    resolvedOptions,
    ideGsmOptionMeta,
    handleSelectionChange,
    removeDialogOpen,
    setRemoveDialogOpen,
    routeRefLoading,
    routeRefError,
    routeRefCount,
    removeInProgress,
    confirmRemoveFile,
    getSupportedIcons,
  };
};
