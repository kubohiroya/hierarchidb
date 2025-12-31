import { PluginStepRegistry, type StartBatchContext, type PluginStepProps } from '@hierarchidb/plugin-base';
import type { NodeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import type { LocationEntity, LocationDataSource, LocationSearchConfig, LocationType } from '../../common/types/index.js';
import type { LocationPointProperties } from '../../common/entities/LocationPoint.js';
import { LocationDataSourceStep } from './steps/LocationDataSourceStep.js';
import { LocationSelectionStep } from './steps/LocationSelectionStep.js';
import { LocationBatchParametersStep } from './steps/LocationBatchParametersStep.js';
import { LocationMapPreviewStep } from './steps/LocationMapPreviewStep.js';
import { LocationBuildStep } from './steps/LocationBuildStep.js';
import { LocationTileSettingsStep } from './steps/LocationTileSettingsStep.js';
import { notify } from '@hierarchidb/components';
import { LocationVectorTileService } from '../../services/tiles/LocationVectorTileService.js';
import { i18n } from '@hierarchidb/ui-i18n';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { ensureIso3166Data, getAllCountries } from '@hierarchidb/gen-iso3166-2/browser';
import { BASE_LOCATION_TYPES, resolveTypesForSource } from './steps/locationTypes.js';
import { LocationBatchManager } from '../../services/LocationBatchManager.js';
import { getEphemeralLocationDB } from '../../database/EphemeralLocationDB.js';
import { proxy } from 'comlink';
import {
  IDE_GSM_BULK_CHUNK_SIZE,
  type IdeGsmImportProgress,
  type IdeGsmLocationPointInput,
} from '@hierarchidb/plugin-service-api';
import { clearIdeGsmProgress, updateIdeGsmProgress } from '../state/ideGsmProgress.js';

const registry = PluginStepRegistry.getInstance();

// Step payload = Partial<LocationEntity>; treeNode metadataはホスト Basic Info で管理する。
type LocationStepData = Partial<LocationEntity> & {
  draftMetadata?: TreeNodeMetadata | null;
};

const DEFAULT_CSV_URL = '/iso3166-2-level1.csv';

const LOCATION_QUERY_LABELS: Record<LocationType, string> = {
  area_centroid: 'administrative center',
  airport: 'airport',
  port: 'port',
  railway_station: 'railway station',
  interchange: 'motorway junction',
};

const ensureData = (data?: LocationStepData): LocationStepData => ({
  ...(data ?? {}),
  draftMetadata: (data?.draftMetadata ?? { name: '', description: '', tags: [] }) as TreeNodeMetadata,
});

const mergeData = (
  current: LocationStepData,
  updates: Partial<LocationStepData>
): LocationStepData => ({
  ...current,
  ...updates,
});

type StepProps = PluginStepProps<LocationStepData>;

const hasSelection = (data?: LocationStepData): boolean => {
  const selected = data?.selectedArrayByCountries ?? {};
  return Object.values(selected).some((row) => Array.isArray(row) && row.some(Boolean));
};

const hasTileSettings = (data?: LocationStepData): boolean => {
  const minZoom = data?.tilesMinZoom ?? DEFAULT_MIN_ZOOM;
  const maxZoom = data?.tilesMaxZoom ?? DEFAULT_MAX_ZOOM;
  const workers = data?.tileWorkers ?? DEFAULT_TILE_WORKERS;
  return Number.isFinite(minZoom) && Number.isFinite(maxZoom) && workers >= MIN_CONCURRENCY && minZoom <= maxZoom;
};

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 16;
const DEFAULT_MIN_ZOOM = 5;
const DEFAULT_MAX_ZOOM = 12;
const DEFAULT_TILE_WORKERS = 4;
const LICENSE_REQUIRED = false;
const UNSUPPORTED_DATA_SOURCES: LocationDataSource[] = ['geonames', 'wikidata', 'custom'];

const canStartLocationBatch = (data?: Partial<LocationEntity>): boolean => {
  if (!data?.dataSource) return false;
  if (!hasSelection(data)) return false;
  if (data.dataSource === 'ide-gsm') {
    return Boolean(data.ideGsmSourceUrl);
  }
  return true;
};

const isLocationBuildPersisted = async (data?: Partial<LocationEntity>): Promise<boolean> => {
  const nodeId = data?.nodeId as NodeId | undefined;
  if (!nodeId) return Boolean(data?.processingStatus === 'completed');
  const db = getEphemeralLocationDB();
  const count = await db.vectorTiles.where('nodeId').equals(nodeId).count();
  if (count > 0) return true;
  return data?.processingStatus === 'completed';
};

const tNs = (key: string, fallback: string) =>
  String(i18n.t(key, { ns: 'location-plugin', defaultValue: fallback }));

type SelectionEntry = {
  countryCode: string;
  countryName: string;
  types: LocationType[];
};

const resolveSelectionEntries = async (
  selectedArrayByCountries?: Record<string, boolean[]>,
  allowedTypes?: LocationType[],
): Promise<SelectionEntry[]> => {
  if (!selectedArrayByCountries || Object.keys(selectedArrayByCountries).length === 0) return [];
  await ensureIso3166Data({ csvUrl: DEFAULT_CSV_URL });
  const countries = await getAllCountries();
  const allowedTypeSet = allowedTypes ? new Set(allowedTypes) : null;
  return countries.map((country) => {
    const row = selectedArrayByCountries?.[country.alpha2] ?? [];
    const types = BASE_LOCATION_TYPES
      .map((typeDef, colIdx) =>
        row[colIdx] && (!allowedTypeSet || allowedTypeSet.has(typeDef.id)) ? typeDef.id : null)
      .filter((type): type is LocationType => Boolean(type));
    return {
      countryCode: country.alpha2,
      countryName: country.countryEn,
      types,
    };
  }).filter((entry) => entry.types.length > 0);
};

const buildSearchConfigs = async (
  dataSource: LocationDataSource,
  selectedArrayByCountries?: Record<string, boolean[]>,
): Promise<LocationSearchConfig[]> => {
  const entries = await resolveSelectionEntries(selectedArrayByCountries, resolveTypesForSource(dataSource));
  return entries.flatMap((entry) =>
    entry.types.map((type) => {
      const label = LOCATION_QUERY_LABELS[type] ?? type;
      const query = entry.countryName
        ? `${label} ${entry.countryName}`
        : label;
      return {
        dataSource,
        query,
        countryCode: entry.countryCode,
        countryName: entry.countryName,
        types: [type],
      } satisfies LocationSearchConfig;
    }),
  );
};

const toLocationPointInput = (point: LocationPointProperties): IdeGsmLocationPointInput => ({
  lon: Number(point.longitude) || 0,
  lat: Number(point.latitude) || 0,
  id: point.pointId,
  properties: {
    name: point.name,
    kind: point.kind,
    countryCode: point.countryCode,
    countryName: point.countryName,
    admin1: point.admin1,
    admin2: point.admin2,
    ...(point.metadata ?? {}),
  },
});

const persistLocationDraft = async (
  nodeId: NodeId,
  draft: LocationStepData,
  patch: Partial<LocationEntity>,
): Promise<void> => {
  try {
    const bridge = getWorkerBridge();
    await bridge.initialize();
    const updater = await bridge.getTreeNodeUpdaterAPI();
    await updater.updateTreeNode(nodeId, {
      mode: 'save-draft',
      draftData: {
        ...(draft ?? {}),
        ...patch,
      } as Record<string, unknown>,
    });
  } catch (error) {
    console.warn('[LocationStepsProvider] failed to persist draft', error);
  }
};

const startLocationBatch = async (data: LocationStepData, context: StartBatchContext) => {
  const draft = data ?? {};
  const nodeId = context.nodeId as NodeId | undefined;

  if (!nodeId) {
    notify.error(tNs('build.errors.saveFirst', 'Save changes before starting a build.'));
    return;
  }

  if (!draft.dataSource) {
    notify.info(tNs('build.requiresApproval', 'Provide a data source and save the node before building.'));
    return;
  }
  if (UNSUPPORTED_DATA_SOURCES.includes(draft.dataSource)) {
    notify.warning(tNs('build.dataSourceUnsupported', 'This data source is not supported yet.'));
    return;
  }

  const allowedTypes = resolveTypesForSource(draft.dataSource);
  const selectionEntries = await resolveSelectionEntries(draft.selectedArrayByCountries, allowedTypes);
  if (selectionEntries.length === 0) {
    notify.info(tNs('build.noSelection', 'No country/type selections found.'));
    return;
  }

  let pointInputs: IdeGsmLocationPointInput[] = [];
  if (draft.dataSource === 'ide-gsm') {
    if (!draft.ideGsmSourceUrl) {
      notify.error(tNs('dataSource.ideGsm.missing', 'IDE-GSM source URL is required.'));
      return;
    }
    try {
      const bridge = getWorkerBridge();
      await bridge.initialize();
      const mutationApi = await bridge.getLocationMutationAPI();
      const progressHandler = proxy((progress: IdeGsmImportProgress) => {
        updateIdeGsmProgress(nodeId, progress);
      });
      const result = await mutationApi.importIdeGsmLocations(
        {
          nodeId,
          sourceUrl: draft.ideGsmSourceUrl,
          selectionEntries,
          chunkSize: IDE_GSM_BULK_CHUNK_SIZE,
        },
        progressHandler,
      );
      pointInputs = result.points;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateIdeGsmProgress(nodeId, { phase: 'failed', message, timestamp: Date.now() });
      notify.error(
        `${tNs('dataSource.ideGsm.fetchError', 'Failed to load IDE-GSM file.')} ${message}`,
      );
      return;
    }
  } else {
    const searchConfigs = await buildSearchConfigs(draft.dataSource, draft.selectedArrayByCountries);
    if (searchConfigs.length === 0) {
      notify.info(tNs('build.noSelection', 'No country/type selections found.'));
      return;
    }
    const rawConcurrency = draft.concurrentDownloads ?? 4;
    const concurrency = clamp(rawConcurrency || 4, MIN_CONCURRENCY, MAX_CONCURRENCY);
    const manager = new LocationBatchManager();
    const points = await manager.collectLocationPoints(nodeId, {
      searchConfigs,
      processingOptions: { concurrent: concurrency },
      filterCriteria: {
        countryCodes: selectionEntries.map((entry) => entry.countryCode),
        countryNames: selectionEntries.map((entry) => entry.countryName),
        allowedTypes: selectionEntries.flatMap((entry) => entry.types),
      },
    });
    pointInputs = points.map(toLocationPointInput);
  }

  if (!pointInputs.length) {
    notify.info(tNs('build.noPoints', 'No location points available to process.'));
    if (draft.dataSource === 'ide-gsm') {
      clearIdeGsmProgress(nodeId);
    }
    return;
  }

  const settings = {
    zoomMinGenerate: draft.tilesMinZoom ?? DEFAULT_MIN_ZOOM,
    zoomMaxGenerate: draft.tilesMaxZoom ?? DEFAULT_MAX_ZOOM,
    zoomMaxServe: draft.tilesMaxZoom ?? DEFAULT_MAX_ZOOM,
    tileWorkers: draft.tileWorkers ?? DEFAULT_TILE_WORKERS,
  } as const;

  const rawConcurrency = draft.concurrentDownloads ?? 4;
  const concurrency = clamp(rawConcurrency || 4, MIN_CONCURRENCY, MAX_CONCURRENCY);
  const tileWorkers = clamp(draft.tileWorkers ?? DEFAULT_TILE_WORKERS, MIN_CONCURRENCY, MAX_CONCURRENCY);

  const service = new LocationVectorTileService();
  const summary = await service.startSession(
    nodeId,
    pointInputs,
    settings,
    { concurrency: tileWorkers, tileWorkers },
  );

  if (draft.dataSource === 'ide-gsm') {
    clearIdeGsmProgress(nodeId);
  }

  await persistLocationDraft(nodeId, draft, {
    batchSessionId: summary.sessionId,
    processingStatus: 'processing',
    lastProcessedAt: Date.now(),
  });

  notify.success(
    tNs('build.success', 'Build started (session {{sessionId}})').replace(
      '{{sessionId}}',
      summary.sessionId
    )
  );
};

registry.registerConfigProvider<LocationStepData>({
  nodeType: 'location',
  getCreateStepConfigs() {
    return [
      {
        id: 'data-source',
        label: String(i18n.t('steps.dataSource.label', { ns: 'location-plugin', defaultValue: 'Data Source' })),
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return (
            <LocationDataSourceStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeData(draft, updates))}
              licenseRequired={LICENSE_REQUIRED}
              disabled={Boolean(p.disabled)}
            />
          );
        },
        validate: (data?: LocationStepData) => Boolean(data?.dataSource),
      },
      {
        id: 'selection',
        label: String(i18n.t('steps.selection.label', { ns: 'location-plugin', defaultValue: 'Location Selection' })),
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return (
            <LocationSelectionStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeData(draft, updates))}
            />
          );
        },
        validate: (data?: LocationStepData) => hasSelection(data),
      },
      {
        id: 'batch-parameters',
        label: String(i18n.t('steps.batchParameters.label', { ns: 'location-plugin', defaultValue: 'Processing Settings' })),
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return (
            <LocationBatchParametersStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeData(draft, updates))}
              nodeId={p.nodeId as NodeId | undefined}
              disabled={Boolean(p.disabled)}
            />
          );
        },
        validate: () => true,
      },
      {
        id: 'tile-settings',
        label: String(i18n.t('steps.tileSettings.label', { ns: 'location-plugin', defaultValue: 'Vector Tile Settings' })),
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return (
            <LocationTileSettingsStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeData(draft, updates))}
              disabled={Boolean(p.disabled)}
            />
          );
        },
        validate: hasTileSettings,
      },
      {
        id: 'build',
        label: String(i18n.t('steps.build.label', { ns: 'location-plugin', defaultValue: 'Build' })),
        optional: false,
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return <LocationBuildStep draft={draft} nodeId={p.nodeId} onUpdate={p.onChange} />;
        },
        validate: (data?: LocationStepData) => isLocationBuildPersisted(data),
        capabilities: {
          canStartBatch: canStartLocationBatch,
          startBatch: (data, context) => startLocationBatch(data, context),
        },
      },
      {
        id: 'map-preview',
        label: String(i18n.t('steps.mapPreview.label', { ns: 'location-plugin', defaultValue: 'Map Preview' })),
        optional: true,
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return (
            <LocationMapPreviewStep
              draft={draft}
              nodeId={p.nodeId as unknown as NodeId | undefined}
            />
          );
        },
        validate: (data?: LocationStepData) => isLocationBuildPersisted(data),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
