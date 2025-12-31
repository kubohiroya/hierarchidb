import {
  PluginStepRegistry,
  type PluginStepProps,
  type PluginStepConfig,
  type StartBatchContext,
  type StepData,
} from '@hierarchidb/plugin-base';
import type { NodeId } from '@hierarchidb/common-types';
import type { RouteUpdaterPayload } from '../../common/types/index.js';
import { toRouteUpdaterPayload } from '../../common/utils/draft.js';
import { useTranslation as getTranslation } from '../../common/i18n/index.js';
import { RouteSelectionStep } from './steps/RouteSelectionStep.js';
import { RouteProcessingStep } from './steps/RouteProcessingStep.js';
import { RouteDataSourceStep } from './steps/RouteDataSourceStep.js';
import { RouteBuildStep } from './steps/RouteBuildStep.js';
import { RoutePreviewStep } from './steps/RoutePreviewStep.js';
import { RouteTileSettingsStep } from './steps/RouteTileSettingsStep.js';
import { notify } from '@hierarchidb/components';
import { RouteVectorTileService } from '../../services/RouteVectorTileService.js';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';

const registry = PluginStepRegistry.getInstance();

type RouteStepData = StepData & RouteUpdaterPayload;

type StepProps = PluginStepProps<RouteStepData>;

const DEFAULT_TILE_MIN_ZOOM = 5;
const DEFAULT_TILE_MAX_ZOOM = 12;
const DEFAULT_TILE_WORKERS = 4;

const ensureDraft = (data?: PluginStepProps['data']): RouteStepData => {
  const fallbackId = 'route-draft' as NodeId;
  if (data && typeof data === 'object') {
    const cast = data as Partial<RouteUpdaterPayload> & { id?: string; parentId?: NodeId };
    const base = toRouteUpdaterPayload(
      cast as RouteUpdaterPayload,
      (cast.treeNodeId ?? cast.id ?? fallbackId) as NodeId,
    );
    return {
      ...(base as RouteUpdaterPayload),
    };
  }
  const base = toRouteUpdaterPayload(null, fallbackId);
  return {
    ...(base as RouteUpdaterPayload),
  };
};

const mergeDraft = (current: RouteStepData, updates: Partial<RouteStepData>): RouteStepData => {
  const nextDraftMetadata = updates.draftMetadata ?? current.draftMetadata ?? null;
  const nextDraftData = {
    ...(current.draftData ?? {}),
    ...(updates.draftData ?? {}),
  };
  return {
    ...current,
    ...updates,
    draftMetadata: nextDraftMetadata,
    draftData: nextDraftData,
  };
};

const hasRouteConfig = (data?: RouteStepData): boolean => {
  const draftData = data?.draftData ?? {};
  return Boolean(
    draftData.dataSourceName &&
      draftData.transportMode &&
      draftData.generationMethod &&
      draftData.startLocationId &&
      draftData.endLocationId
  );
};

const hasTileSettings = (data?: RouteStepData): boolean => {
  const vectorTiles = data?.draftData?.processing?.vectorTiles;
  const minZoom = vectorTiles?.minZoom ?? DEFAULT_TILE_MIN_ZOOM;
  const maxZoom = vectorTiles?.maxZoom ?? DEFAULT_TILE_MAX_ZOOM;
  const workers = vectorTiles?.tileWorkers ?? DEFAULT_TILE_WORKERS;
  return Number.isFinite(minZoom) && Number.isFinite(maxZoom) && minZoom <= maxZoom && workers >= 1;
};

const isRouteBuildPersisted = (data?: RouteStepData): boolean =>
  data?.draftData?.processingStatus === 'completed';

const persistRouteDraft = async (nodeId: NodeId, data: RouteStepData, updates: Partial<RouteStepData['draftData']>): Promise<void> => {
  try {
    const bridge = getWorkerBridge();
    await bridge.initialize();
    const updater = await bridge.getTreeNodeUpdaterAPI();
    await updater.updateTreeNode(nodeId, {
      mode: 'save-draft',
      draftData: {
        ...(data.draftData ?? {}),
        ...updates,
      } as Record<string, unknown>,
    });
  } catch (error) {
    console.warn('[RouteStepsProvider] failed to persist route draft', error);
  }
};

const startRouteBatch = async (data: RouteStepData, context: StartBatchContext) => {
  const { t } = getTranslation();
  const draft = data?.draftData ?? {};
  const nodeId = context.nodeId as NodeId | undefined;
  const hasEssentials = Boolean(
    draft.dataSourceName &&
      draft.transportMode &&
      draft.generationMethod &&
      draft.startLocationId &&
      draft.endLocationId
  );

  if (!nodeId) {
    notify.info(t('messages.completeBeforeBuild', 'Complete the required route settings before starting a build.'));
    return;
  }

  if (!hasEssentials) {
    notify.info(t('messages.completeBeforeBuild', 'Complete the required route settings before starting a build.'));
    return;
  }

  if (!Array.isArray(draft.lineGeometry) || draft.lineGeometry.length === 0) {
    notify.error(t('build.errors.missingGeometry', 'Route geometry is required before starting vector tile generation.'));
    return;
  }

  const vectorTiles = draft.processing?.vectorTiles ?? {};
  const settings = {
    minZoom: vectorTiles.minZoom ?? DEFAULT_TILE_MIN_ZOOM,
    maxZoom: vectorTiles.maxZoom ?? DEFAULT_TILE_MAX_ZOOM,
    tileWorkers: vectorTiles.tileWorkers ?? DEFAULT_TILE_WORKERS,
  };

  const service = new RouteVectorTileService();
  try {
    const summary = await service.startSession(nodeId, [draft.lineGeometry as [number, number][]], settings);
    await persistRouteDraft(nodeId, data, {
      batchSessionId: summary.sessionId,
      processingStatus: 'completed',
      zoomRange: [settings.minZoom, settings.maxZoom],
      tabularSourceId: summary.tableId,
      lastProcessedAt: Date.now(),
    });
    notify.success(
      t('build.started', 'Route vector tile build started (session {{sessionId}})').replace('{{sessionId}}', summary.sessionId),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notify.error(t('build.errors.startFailed', 'Failed to start vector tile build: {{message}}').replace('{{message}}', message));
  }
};

registry.registerConfigProvider<RouteStepData>({
  nodeType: 'route',
  getCreateStepConfigs(): PluginStepConfig<RouteStepData>[] {
    const { t } = getTranslation();
    return [
      {
        id: 'data-source',
        label: t('steps.dataSource.label', 'Data Source'),
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <RouteDataSourceStep
              draft={draft as unknown as RouteUpdaterPayload}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, { draftData: updates }))}
              onValidationChange={p.setValid}
            />
          );
        },
        validate: (data?: RouteStepData) => Boolean(data?.draftData?.dataSourceName),
      },
      {
        id: 'route-config',
        label: t('steps.routeConfig.label', 'Transport & Endpoints'),
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <RouteSelectionStep
              draft={draft as unknown as RouteUpdaterPayload}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, { draftData: updates }))}
              onValidationChange={p.setValid}
              mode={p.mode}
              nodeId={p.nodeId}
              parentId={p.parentId}
            />
          );
        },
        validate: hasRouteConfig,
      },
      {
        id: 'processing',
        label: t('steps.processing.label', 'Processing Settings'),
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <RouteProcessingStep
              draft={draft as unknown as RouteUpdaterPayload}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, { draftData: updates }))}
              nodeId={p.nodeId as NodeId | undefined}
              disabled={Boolean(p.disabled)}
            />
          );
        },
        validate: () => true,
      },
      {
        id: 'tile-settings',
        label: t('steps.tileSettings.label', 'Vector Tile Settings'),
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <RouteTileSettingsStep
              draft={draft as unknown as RouteUpdaterPayload}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, { draftData: updates }))}
              disabled={Boolean(p.disabled)}
            />
          );
        },
        validate: hasTileSettings,
      },
      {
        id: 'build',
        label: t('steps.build.label', 'Build'),
        optional: false,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <RouteBuildStep
              draft={draft as unknown as RouteUpdaterPayload}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, { draftData: updates }))}
              nodeId={p.nodeId}
              parentId={p.parentId}
              mode={p.mode}
            />
          );
        },
        capabilities: {
          canStartBatch: (data: RouteStepData) => {
            const draft = data?.draftData ?? {};
            return Boolean(
              draft.dataSourceName &&
                draft.transportMode &&
                draft.generationMethod &&
                draft.startLocationId &&
                draft.endLocationId &&
                hasTileSettings(data)
            );
          },
          startBatch: (data, context) => startRouteBatch(data as RouteStepData, context),
        },
        validate: (data?: RouteStepData) => isRouteBuildPersisted(data),
      },
      {
        id: 'preview',
        label: t('steps.preview.label', 'Preview'),
        optional: true,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return <RoutePreviewStep draft={draft as unknown as RouteUpdaterPayload} nodeId={p.nodeId as NodeId | undefined} />;
        },
        validate: (data?: RouteStepData) => isRouteBuildPersisted(data),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
