import {
  PluginStepRegistry,
  type PluginStepProps,
  type PluginStepConfig,
  type StartBatchContext,
  type StepData,
} from '@hierarchidb/plugin-base';
import { toNodeId, type NodeId } from '@hierarchidb/core-types';
import type { RouteEntity } from '@hierarchidb/route-api';
import type { RouteUpdaterPayload } from '../../common/types/index.js';
import {
  extractRouteEntity,
  hasAnyRouteSelection,
  resolveRouteDataSourceName,
  toRouteUpdaterPayload,
} from '../../common/utils/draft.js';
import { useTranslation as getTranslation } from '../../common/i18n/index.js';
import { RouteSelectionStep } from './steps/RouteSelectionStep.js';
import { RouteProcessingStep } from './steps/RouteProcessingStep.js';
import { RouteDataSourceStep } from './steps/RouteDataSourceStep.js';
import { RouteBuildStep } from './steps/RouteBuildStep.js';
import { RoutePreviewStep } from './steps/RoutePreviewStep.js';
import { notify } from '@hierarchidb/components';

const registry = PluginStepRegistry.getInstance();

type RouteStepData = StepData & RouteUpdaterPayload;

type StepProps = PluginStepProps<RouteStepData>;

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

const resolveNodeId = (nodeId?: string): NodeId | undefined => (
  typeof nodeId === 'string' && nodeId.length > 0 ? toNodeId(nodeId) : undefined
);

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

const createDraftUpdater = (
  initial: RouteStepData,
  onChange: (next: RouteStepData) => void,
): ((updates: Partial<RouteEntity>) => void) => {
  let latestDraft = initial;
  return (updates) => {
    latestDraft = mergeDraft(latestDraft, { draftData: updates });
    onChange(latestDraft);
  };
};

const canProceedFromDataSource = (data?: RouteStepData): boolean => {
  const draftData = extractRouteEntity(data);
  const dataSourceName = resolveRouteDataSourceName(data);
  if (dataSourceName === 'ide-gsm') {
    return Boolean(draftData.tabularSourceId);
  }
  return Boolean(dataSourceName);
};

const hasRouteConfig = (data?: RouteStepData): boolean => {
  const draftData = extractRouteEntity(data);
  return Boolean(
    resolveRouteDataSourceName(data) &&
    hasAnyRouteSelection(draftData.selectedArrayByCountries),
  );
};

const isRouteBuildPersisted = (data?: RouteStepData): boolean =>
  extractRouteEntity(data).processingStatus === 'completed';

const startRouteBatch = async (data: RouteStepData, _context: StartBatchContext) => {
  const { t } = getTranslation();
  const draft = extractRouteEntity(data);
  const hasEssentials = Boolean(
    resolveRouteDataSourceName(data) &&
    hasAnyRouteSelection(draft.selectedArrayByCountries),
  );

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
          const draft = ensureDraft(p.data);
          const handleUpdate = createDraftUpdater(draft, p.onChange);
          return (
            <RouteDataSourceStep
              draft={draft}
              onUpdate={handleUpdate}
              onValidationChange={p.setValid}
              nodeId={resolveNodeId(p.nodeId)}
            />
          );
        },
        validate: (data?: RouteStepData) => canProceedFromDataSource(data),
      },
      {
        id: 'route-config',
        label: t('steps.routeConfig.label', 'Route Selection'),
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          const handleUpdate = createDraftUpdater(draft, p.onChange);
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
          const draft = ensureDraft(p.data);
          const handleUpdate = createDraftUpdater(draft, p.onChange);
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
          const draft = ensureDraft(p.data);
          const handleUpdate = createDraftUpdater(draft, p.onChange);
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
            const draft = extractRouteEntity(data);
            return Boolean(
              resolveRouteDataSourceName(data) &&
              hasAnyRouteSelection(draft.selectedArrayByCountries),
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
