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

const isRouteBuildPersisted = (data?: RouteStepData): boolean =>
  data?.processingStatus === 'completed';

const startRouteBatch = async (data: RouteStepData, _context: StartBatchContext) => {
  const { t } = getTranslation();
  const draft = data?.draftData ?? {};
  const hasEssentials = Boolean(
    draft.dataSourceName &&
      draft.transportMode &&
      draft.generationMethod &&
      draft.startLocationId &&
      draft.endLocationId
  );

  if (!hasEssentials) {
    notify.info(t('messages.completeBeforeBuild', 'Complete the required route settings before starting a build.'));
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
            />
          );
        },
        validate: () => true,
      },
      {
        id: 'build',
        label: t('steps.build.label', 'Build'),
        optional: false,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return <RouteBuildStep draft={draft as unknown as RouteUpdaterPayload} />;
        },
        capabilities: {
          canStartBatch: (data: RouteStepData) => {
            const draft = data?.draftData ?? {};
            return Boolean(
              draft.dataSourceName &&
                draft.transportMode &&
                draft.generationMethod &&
                draft.startLocationId &&
                draft.endLocationId
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
          return <RoutePreviewStep draft={draft as unknown as RouteUpdaterPayload} />;
        },
        validate: (data?: RouteStepData) => isRouteBuildPersisted(data),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
