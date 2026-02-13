import {
  PluginStepRegistry,
  type PluginStepProps,
  type PluginStepConfig,
  type StartBatchContext,
} from '@hierarchidb/plugin-base';
import { toNodeId, type NodeId } from '@hierarchidb/core-types';
import type { RouteEntity } from '@hierarchidb/route-api';
import type { RouteUpdaterPayload } from '../../common/types/index.js';
import { useTranslation as getTranslation } from '../../common/i18n/index.js';
import { RouteSelectionStep } from './steps/RouteSelectionStep.js';
import { RouteProcessingStep } from './steps/RouteProcessingStep.js';
import { RouteDataSourceStep } from './steps/RouteDataSourceStep.js';
import { RouteBuildStep } from './steps/RouteBuildStep.js';
import { RoutePreviewStep } from './steps/RoutePreviewStep.js';
import { notify } from '@hierarchidb/components';

const registry = PluginStepRegistry.getInstance();

type RouteStepData = Partial<RouteEntity>;

type StepProps = PluginStepProps<RouteStepData>;

const resolveNodeId = (nodeId?: string): NodeId | undefined => (
  typeof nodeId === 'string' && nodeId.length > 0 ? toNodeId(nodeId) : undefined
);

const toStepDraftPayload = (data: RouteStepData | undefined, nodeId?: string): RouteUpdaterPayload => {
  const fallbackId = 'route-draft' as NodeId;
  return {
    treeNodeId: resolveNodeId(nodeId) ?? fallbackId,
    draftMetadata: { name: '', description: '', tags: [] },
    draftData: { ...(data ?? {}) } as RouteEntity,
  } as RouteUpdaterPayload;
};

const mergeRouteData = (current: RouteStepData | undefined, updates: Partial<RouteEntity>): RouteStepData => ({
  ...(current ?? {}),
  ...updates,
});

const createRouteDataUpdater = (
  initial: RouteStepData | undefined,
  onChange: (next: RouteStepData) => void,
): ((updates: Partial<RouteEntity>) => void) => {
  let latest = initial ?? {};
  return (updates) => {
    latest = mergeRouteData(latest, updates);
    onChange(latest);
  };
};

const hasAnyRouteSelection = (selection?: Record<string, boolean[]>): boolean =>
  Boolean(selection && Object.values(selection).some((row) => row?.some(Boolean)));

const hasRouteDataSourceReady = (draftData?: Partial<RouteEntity>): boolean => {
  if (!draftData?.dataSourceName) {
    return false;
  }
  if (draftData.dataSourceName === 'ide-gsm') {
    return Boolean(draftData.tabularSourceId);
  }
  return true;
};

const hasRouteConfig = (data?: RouteStepData): boolean => {
  const draftData = data ?? {};
  return Boolean(hasRouteDataSourceReady(draftData) && hasAnyRouteSelection(draftData.selectedArrayByCountries));
};

const isRouteBuildPersisted = (data?: RouteStepData): boolean =>
  data?.processingStatus === 'completed';

const startRouteBatch = async (data: RouteStepData, _context: StartBatchContext) => {
  const { t } = getTranslation();
  const draft = data ?? {};
  const hasEssentials = Boolean(hasRouteDataSourceReady(draft) && hasAnyRouteSelection(draft.selectedArrayByCountries));

  if (!hasEssentials) {
    notify.info(t('messages.completeBeforeBuild', 'Complete the required route settings before starting a stage.'));
    return;
  }

  notify.info(t('messages.batchNotImplemented', 'Route batch launch is not yet implemented in this dialog.'));
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
          const routeData = p.data ?? {};
          const draft = toStepDraftPayload(routeData, p.nodeId);
          const handleUpdate = createRouteDataUpdater(routeData, p.onChange);
          return (
            <RouteDataSourceStep
              draft={draft}
              onUpdate={handleUpdate}
              onValidationChange={p.setValid}
              nodeId={resolveNodeId(p.nodeId)}
            />
          );
        },
        validate: (data?: RouteStepData) => hasRouteDataSourceReady(data),
      },
      {
        id: 'route-config',
        label: t('steps.routeConfig.label', 'Route Selection'),
        componentFactory: (p: StepProps) => {
          const routeData = p.data ?? {};
          const draft = toStepDraftPayload(routeData, p.nodeId);
          const handleUpdate = createRouteDataUpdater(routeData, p.onChange);
          return (
            <RouteSelectionStep
              draft={draft}
              onUpdate={handleUpdate}
              onValidationChange={p.setValid}
              mode={p.mode}
              nodeId={resolveNodeId(p.nodeId)}
              parentId={resolveNodeId(p.parentId)}
            />
          );
        },
        validate: hasRouteConfig,
      },
      {
        id: 'processing',
        label: t('steps.processing.label', 'Settings'),
        componentFactory: (p: StepProps) => {
          const routeData = p.data ?? {};
          const draft = toStepDraftPayload(routeData, p.nodeId);
          const handleUpdate = createRouteDataUpdater(routeData, p.onChange);
          return (
            <RouteProcessingStep
              draft={draft}
              onUpdate={handleUpdate}
              nodeId={resolveNodeId(p.nodeId)}
              disabled={Boolean(p.disabled)}
            />
          );
        },
        validate: () => true,
      },
      {
        id: 'build',
        label: t('steps.stage.label', 'Build'),
        optional: false,
        componentFactory: (p: StepProps) => {
          const routeData = p.data ?? {};
          const draft = toStepDraftPayload(routeData, p.nodeId);
          const handleUpdate = createRouteDataUpdater(routeData, p.onChange);
          return (
            <RouteBuildStep
              draft={draft}
              onUpdate={handleUpdate}
              nodeId={resolveNodeId(p.nodeId)}
              parentId={resolveNodeId(p.parentId)}
              mode={p.mode}
            />
          );
        },
        capabilities: {
          canStartBatch: (data: RouteStepData) => {
            const draft = data ?? {};
            return Boolean(
              hasRouteDataSourceReady(draft) && hasAnyRouteSelection(draft.selectedArrayByCountries),
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
          const draft = toStepDraftPayload(p.data ?? {}, p.nodeId);
          return <RoutePreviewStep draft={draft} nodeId={resolveNodeId(p.nodeId)} />;
        },
        validate: (data?: RouteStepData) => isRouteBuildPersisted(data),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
