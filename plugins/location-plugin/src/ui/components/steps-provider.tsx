import { PluginStepRegistry, type StartBatchContext, type PluginStepProps } from '@hierarchidb/plugin-base';
import type { NodeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import type { LocationEntity, LocationDataSource, LocationSearchConfig, LocationType } from '../../common/types/index.js';
import type { LocationPointProperties } from '../../common/entities/LocationPoint.js';
import { LocationDataSourceStep } from './steps/LocationDataSourceStep.js';
import { LocationSelectionStep } from './steps/LocationSelectionStep.js';
import { LocationBatchParametersStep } from './steps/LocationBatchParametersStep.js';
import { LocationMapPreviewStep } from './steps/LocationMapPreviewStep.js';
import { LocationBuildStep } from './steps/LocationBuildStep.js';
import { notify } from '@hierarchidb/components';
import { replaceLocationPoints } from '../../services/pointRepository.js';
import { LocationVectorTileService } from '../../services/tiles/LocationVectorTileService.js';
import { i18n } from '@hierarchidb/ui-i18n';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { ensureIso3166Data, getAllCountries } from '@hierarchidb/gen-iso3166-2/browser';
import { BASE_LOCATION_TYPES } from './steps/locationTypes.js';
import { LocationBatchManager } from '../../services/LocationBatchManager.js';
import { getEphemeralLocationDB } from '../../database/EphemeralLocationDB.js';

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
  const matrix = data?.selectionMatrix;
  if (!Array.isArray(matrix)) return false;
  return matrix.some((row) => Array.isArray(row) && row.some(Boolean));
};

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 16;
const DEFAULT_MIN_ZOOM = 5;
const DEFAULT_MAX_ZOOM = 12;
const LICENSE_REQUIRED = false;

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

const resolveSelectionEntries = async (selectionMatrix?: boolean[][]): Promise<SelectionEntry[]> => {
  if (!selectionMatrix || selectionMatrix.length === 0) return [];
  await ensureIso3166Data({ csvUrl: DEFAULT_CSV_URL });
  const countries = await getAllCountries();
  return countries.map((country, index) => {
    const row = selectionMatrix[index] ?? [];
    const types = BASE_LOCATION_TYPES
      .map((typeDef, colIdx) => (row[colIdx] ? typeDef.id : null))
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
  selectionMatrix?: boolean[][],
): Promise<LocationSearchConfig[]> => {
  const entries = await resolveSelectionEntries(selectionMatrix);
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

const normalizeMetadataValue = (value: unknown): string | number | null => {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const toMetadataRecord = (raw: Record<string, unknown>, omitKeys: Set<string>) =>
  Object.fromEntries(
    Object.entries(raw)
      .filter(([key]) => !omitKeys.has(key))
      .map(([key, val]) => [key, normalizeMetadataValue(val)]),
  );

const parseIdeGsmPayload = (payload: unknown): LocationPointProperties[] => {
  const points: LocationPointProperties[] = [];
  const handleRecord = (record: Record<string, unknown>, index: number) => {
    const lat = typeof record.latitude === 'number'
      ? record.latitude
      : typeof record.lat === 'number'
        ? record.lat
        : undefined;
    const lon = typeof record.longitude === 'number'
      ? record.longitude
      : typeof record.lon === 'number'
        ? record.lon
        : undefined;
    if (typeof lat !== 'number' || typeof lon !== 'number') return;
    const name = typeof record.name === 'string'
      ? record.name
      : typeof record.label === 'string'
        ? record.label
        : `IDE-GSM ${index + 1}`;
    const kind = typeof record.type === 'string'
      ? record.type
      : typeof record.kind === 'string'
        ? record.kind
        : 'area_centroid';
    const countryCode = typeof record.countryCode === 'string'
      ? record.countryCode
      : typeof record.country_code === 'string'
        ? record.country_code
        : '';
    const countryName = typeof record.countryName === 'string'
      ? record.countryName
      : typeof record.country === 'string'
        ? record.country
        : undefined;
    const admin1 = typeof record.admin1 === 'string'
      ? record.admin1
      : typeof record.adminCode1 === 'string'
        ? record.adminCode1
        : undefined;
    const admin2 = typeof record.admin2 === 'string'
      ? record.admin2
      : typeof record.adminCode2 === 'string'
        ? record.adminCode2
        : undefined;
    const omit = new Set(['latitude', 'lat', 'longitude', 'lon', 'name', 'label', 'type', 'kind', 'countryCode', 'country_code', 'countryName', 'country', 'admin1', 'admin2', 'adminCode1', 'adminCode2']);
    points.push({
      schemaVersion: 2,
      pid: typeof record.id === 'string' ? record.id : `ide-gsm-${index + 1}`,
      name,
      latitude: lat,
      longitude: lon,
      kind,
      countryCode,
      countryName,
      admin1,
      admin2,
      metadata: toMetadataRecord(record, omit),
      source: {
        provider: 'ide-gsm',
        fetchedAt: Date.now(),
        originalId: typeof record.id === 'string' ? record.id : undefined,
      },
    });
  };

  if (Array.isArray(payload)) {
    payload.forEach((entry, index) => {
      if (typeof entry === 'object' && entry !== null) {
        handleRecord(entry as Record<string, unknown>, index);
      }
    });
    return points;
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.features)) {
      obj.features.forEach((feature, index) => {
        if (!feature || typeof feature !== 'object') return;
        const f = feature as Record<string, unknown>;
        const geometry = f.geometry as Record<string, unknown> | undefined;
        const coordinates = Array.isArray(geometry?.coordinates) ? geometry?.coordinates : [];
        const lon = typeof coordinates[0] === 'number' ? coordinates[0] : undefined;
        const lat = typeof coordinates[1] === 'number' ? coordinates[1] : undefined;
        const props = (f.properties && typeof f.properties === 'object')
          ? f.properties as Record<string, unknown>
          : {};
        handleRecord({ ...props, latitude: lat, longitude: lon, id: props.id ?? f.id }, index);
      });
      return points;
    }
  }

  return points;
};

const filterPointsBySelection = (points: LocationPointProperties[], entries: SelectionEntry[]) => {
  if (entries.length === 0) return points;
  const countrySet = new Set(entries.map((entry) => entry.countryCode));
  const typeSet = new Set(entries.flatMap((entry) => entry.types));
  return points.filter((point) => {
    const matchesCountry = !point.countryCode || countrySet.has(point.countryCode);
    const matchesType = typeSet.size === 0 || typeSet.has(point.kind as LocationType);
    return matchesCountry && matchesType;
  });
};

const toLocationPointInput = (point: LocationPointProperties) => ({
  lon: Number(point.longitude) || 0,
  lat: Number(point.latitude) || 0,
  id: point.pid,
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

  const selectionEntries = await resolveSelectionEntries(draft.selectionMatrix);
  if (selectionEntries.length === 0) {
    notify.info(tNs('build.noSelection', 'No country/type selections found.'));
    return;
  }

  let points: LocationPointProperties[] = [];
  if (draft.dataSource === 'ide-gsm') {
    if (!draft.ideGsmSourceUrl) {
      notify.error(tNs('dataSource.ideGsm.missing', 'IDE-GSM source URL is required.'));
      return;
    }
    try {
      const res = await fetch(draft.ideGsmSourceUrl);
      if (!res.ok) {
        notify.error(tNs('dataSource.ideGsm.fetchError', 'Failed to load IDE-GSM file.'));
        return;
      }
      const payload = await res.json();
      points = parseIdeGsmPayload(payload);
      points = filterPointsBySelection(points, selectionEntries);
      await replaceLocationPoints(nodeId, points);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notify.error(`${tNs('dataSource.ideGsm.fetchError', 'Failed to load IDE-GSM file.')}: ${message}`);
      return;
    }
  } else {
    const searchConfigs = await buildSearchConfigs(draft.dataSource, draft.selectionMatrix);
    if (searchConfigs.length === 0) {
      notify.info(tNs('build.noSelection', 'No country/type selections found.'));
      return;
    }
    const rawConcurrency = draft.concurrentDownloads ?? 4;
    const concurrency = clamp(rawConcurrency || 4, MIN_CONCURRENCY, MAX_CONCURRENCY);
    const manager = new LocationBatchManager();
    points = await manager.collectLocationPoints(nodeId, {
      searchConfigs,
      processingOptions: { concurrent: concurrency },
      filterCriteria: {
        countryCodes: selectionEntries.map((entry) => entry.countryCode),
        allowedTypes: selectionEntries.flatMap((entry) => entry.types),
      },
    });
  }

  if (!points.length) {
    notify.info(tNs('build.noPoints', 'No location points available to process.'));
    return;
  }

  const settings = {
    zoomMinGenerate: draft.tilesMinZoom ?? DEFAULT_MIN_ZOOM,
    zoomMaxGenerate: draft.tilesMaxZoom ?? DEFAULT_MAX_ZOOM,
    zoomMaxServe: draft.tilesMaxZoom ?? DEFAULT_MAX_ZOOM,
  } as const;

  const rawConcurrency = draft.concurrentDownloads ?? 4;
  const concurrency = clamp(rawConcurrency || 4, MIN_CONCURRENCY, MAX_CONCURRENCY);

  const service = new LocationVectorTileService();
  const summary = await service.startSession(
    nodeId,
    points.map(toLocationPointInput),
    settings,
    { concurrency },
  );

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
