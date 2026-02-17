import {
  PluginStepRegistry,
  type PluginStepProps,
  type PluginStepConfig,
  type StartBatchContext,
} from '@hierarchidb/plugin-base';
import { toNodeId, type NodeId } from '@hierarchidb/core-types';
import type { RouteEntity } from '@hierarchidb/route-api';
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

const mergeDraft = (current: RouteStepData, updates: Partial<RouteStepData>): RouteStepData => {
  return {
    ...(current ?? {}),
    ...(updates ?? {}),
  };
};

const normalizeComparableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeComparableValue(entry));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    Object.keys(record)
      .sort()
      .forEach((key) => {
        next[key] = normalizeComparableValue(record[key]);
      });
    return next;
  }
  return value;
};

const serializeComparable = (value: unknown): string => {
  try {
    return JSON.stringify(normalizeComparableValue(value));
  } catch {
    return '';
  }
};

const createDraftUpdater = (
  initial: RouteStepData,
  onChange: (next: RouteStepData) => void,
): ((updates: Partial<RouteEntity>) => void) => {
  let latestDraft = { ...(initial ?? {}) };
  let latestSignature = serializeComparable(latestDraft);
  return (updates) => {
    const nextDraft = mergeDraft(latestDraft, updates);
    const nextSignature = serializeComparable(nextDraft);
    if (nextSignature === latestSignature) {
      return;
    }
    latestDraft = nextDraft;
    latestSignature = nextSignature;
    onChange(latestDraft);
  };
};

const hasAnyRouteSelection = (selection?: Record<string, boolean[]>): boolean =>
  Boolean(selection && Object.values(selection).some((row) => row?.some(Boolean)));

const hasRouteDataSourceReady = (data?: Partial<RouteEntity>): boolean => {
  if (!data?.dataSourceName) {
    return false;
  }
  if (data.dataSourceName === 'ide-gsm') {
    return Boolean(data.tabularSourceId);
  }
  return true;
};

const hasRouteConfig = (data?: RouteStepData): boolean => {
  return Boolean(hasRouteDataSourceReady(data) && hasAnyRouteSelection(data?.selectedArrayByCountries));
};

const isRouteBuildPersisted = (data?: RouteStepData): boolean =>
  data?.processingStatus === 'completed';

const startRouteBatch = async (data: RouteStepData, _context: StartBatchContext) => {
  const { t } = getTranslation();
  const hasEssentials = Boolean(
    hasRouteDataSourceReady(data) && hasAnyRouteSelection(data?.selectedArrayByCountries),
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
          const draft = { ...(p.data ?? {}) };
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
        validate: (data?: RouteStepData) => hasRouteDataSourceReady(data),
      },
      {
        id: 'route-config',
        label: t('steps.routeConfig.label', 'Route Selection'),
        componentFactory: (p: StepProps) => {
          const draft = { ...(p.data ?? {}) };
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
        label: t('steps.processing.label', 'Config'),
        componentFactory: (p: StepProps) => {
          const draft = { ...(p.data ?? {}) };
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
          const draft = { ...(p.data ?? {}) };
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
            return Boolean(
              hasRouteDataSourceReady(data) && hasAnyRouteSelection(data?.selectedArrayByCountries),
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
          const draft = { ...(p.data ?? {}) };
          const handleUpdate = createDraftUpdater(draft, p.onChange);
          return (
            <RoutePreviewStep
              draft={draft}
              nodeId={resolveNodeId(p.nodeId)}
              onUpdate={handleUpdate}
            />
          );
        },
        validate: (data?: RouteStepData) => isRouteBuildPersisted(data),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
