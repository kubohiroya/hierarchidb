import { PluginStepRegistry, type StartBatchContext, type StepComponentProps } from '@hierarchidb/plugin-base';
import type { NodeId } from '@hierarchidb/common-types';
import type { LocationEntity } from '../../common/types/index.js';
import { translations as locationTranslations } from '../../common/i18n/index.js';
import { LocationDataSourceStep } from '../../common/components/steps/LocationDataSourceStep.js';
import { LocationLicenseStep } from '../../common/components/steps/LocationLicenseStep.js';
import { LocationSelectionStep } from '../../common/components/steps/LocationSelectionStep.js';
import { LocationBatchParametersStep } from '../../common/components/steps/LocationBatchParametersStep.js';
import { LocationMapPreviewStep } from '../../common/components/steps/LocationMapPreviewStep.js';
import { LocationBuildStep } from './steps/LocationBuildStep.js';
import { notify } from '@hierarchidb/components';
import { listLocationPoints } from '../../services/pointRepository.js';
import { LocationVectorTileService } from '../../services/tiles/LocationVectorTileService.js';

const registry = PluginStepRegistry.getInstance();

// Step payload = Partial<LocationEntity>; treeNode metadataはホスト Basic Info で管理する。
type LocationStepData = Partial<LocationEntity>;

const ensureData = (data?: LocationStepData): LocationStepData => ({
  ...(data ?? {}),
});

const mergeData = (
  current: LocationStepData,
  updates: Partial<LocationStepData>
): LocationStepData => ({
  ...current,
  ...updates,
});

type StepProps = StepComponentProps<LocationStepData>;

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

const startLocationBatch = async (data: LocationStepData, context: StartBatchContext) => {
  const t = locationTranslations.en;
  const draft = data ?? {};
  const nodeId = context.nodeId as NodeId | undefined;

  if (!nodeId) {
    notify.error('Save changes before starting a build.');
    return;
  }

  if (!(draft.dataSource && draft.licenseAgreement)) {
    notify.info(
      t.build?.requiresApproval ??
        'Provide a data source, accept license terms, and save the node before building.'
    );
    return;
  }

  const pointsRaw = await listLocationPoints(nodeId);
  if (!pointsRaw.length) {
    notify.info(t.build?.noPoints ?? 'No location points available to process.');
    return;
  }

  const points = pointsRaw.map((point) => ({
    lon: Number(point.longitude) || 0,
    lat: Number(point.latitude) || 0,
    id: point.pid,
    properties: {
      name: point.name,
      kind: point.kind,
      gid0: point.gid0,
      gid1: point.gid1,
      gid2: point.gid2,
      ...(point.payload ?? {}),
    },
  }));

  const settings = {
    zoomMinGenerate: draft.tilesMinZoom ?? DEFAULT_MIN_ZOOM,
    zoomMaxGenerate: draft.tilesMaxZoom ?? DEFAULT_MAX_ZOOM,
    zoomMaxServe: draft.tilesMaxZoom ?? DEFAULT_MAX_ZOOM,
  } as const;

  const rawConcurrency = draft.concurrentDownloads ?? 4;
  const concurrency = clamp(rawConcurrency || 4, MIN_CONCURRENCY, MAX_CONCURRENCY);

  const service = new LocationVectorTileService();
  const summary = await service.startSession(nodeId, points, settings, { concurrency });

  notify.success(
    t.build?.success?.replace?.('{sessionId}', summary.sessionId) ??
      `Build started (session ${summary.sessionId})`
  );
};

registry.registerConfigProvider<LocationStepData>({
  nodeType: 'location',
  getCreateStepConfigs() {
    const t = locationTranslations;
    return [
      {
        id: 'data-source',
        label: t.en.dialog.dataSourceLabel,
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return (
            <LocationDataSourceStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeData(draft, updates))}
            />
          );
        },
        validate: (data?: LocationStepData) => Boolean(data?.dataSource),
      },
      {
        id: 'license',
        label: t.en.dialog.licenseAgreementLabel,
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return (
            <LocationLicenseStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeData(draft, updates))}
            />
          );
        },
        validate: (data?: LocationStepData) => Boolean(data?.licenseAgreement),
      },
      {
        id: 'selection',
        label: t.en.selection.title,
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
        label: t.en.panel.processingSettings,
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return (
            <LocationBatchParametersStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeData(draft, updates))}
            />
          );
        },
        validate: () => true,
      },
      {
        id: 'map-preview',
        label: t.en.mapPreview?.title ?? 'Map Preview',
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
        validate: () => true,
      },
      {
        id: 'build',
        label: t.en.build?.actionLabel ?? 'Build',
        optional: true,
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return (
            <LocationBuildStep
              nodeId={p.nodeId}
              draft={draft}
            />
          );
        },
        capabilities: {
          canStartBatch: (data: LocationStepData) =>
            Boolean(data?.dataSource && data?.licenseAgreement),
          startBatch: (data, context) => startLocationBatch(data, context),
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
