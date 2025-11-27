import {
  PluginStepRegistry,
  type StepComponentProps,
  type PluginStepConfig,
  type StartBatchContext,
  type StepData,
} from '@hierarchidb/plugin-base';
import type { NodeId } from '@hierarchidb/common-types';
import type { RouteDraft, TagId } from '../../common/types/index.js';
import { createRouteDraftBase } from '../../common/utils/draft.js';
import { translations as routeTranslations } from '../../common/i18n/index.js';
import { RouteSelectionStep } from '../../common/components/RouteSelectionStep.js';
import { RouteProcessingStep } from '../../common/components/RouteProcessingStep.js';
import { RouteDetailsStep } from '../../common/components/RouteDetailsStep.js';
import { RouteBuildStep } from './steps/RouteBuildStep.js';
import { notify } from '@hierarchidb/components';

const registry = PluginStepRegistry.getInstance();

type RouteStepData = StepData & Partial<RouteDraft>;

type StepProps = StepComponentProps<RouteStepData>;

const ensureDraft = (data?: StepComponentProps['data']): RouteStepData => {
  const fallbackId = 'route-draft' as NodeId;
  if (data && typeof data === 'object') {
    const cast = data as RouteStepData;
    const base = createRouteDraftBase(
      (cast.treeNodeId ?? (cast as { id?: string }).id ?? fallbackId) as NodeId,
      {
        ...cast.draft,
        name: cast.draft?.name ?? '',
        description: cast.draft?.description ?? '',
        tags: cast.tags,
      },
      (cast as { parentId?: NodeId }).parentId
    );
    return {
      ...(base as RouteStepData),
      processingConfig: base.processingConfig ? { ...base.processingConfig } : undefined,
      draft: {
        ...(base.draft ?? {}),
        processingConfig: base.draft?.processingConfig ? { ...base.draft.processingConfig } : undefined,
      },
    };
  }
  const base = createRouteDraftBase(fallbackId, {}, undefined);
  return {
    ...(base as RouteStepData),
    processingConfig: base.processingConfig ? { ...base.processingConfig } : undefined,
    draft: {
      ...(base.draft ?? {}),
      processingConfig: base.draft?.processingConfig ? { ...base.draft.processingConfig } : undefined,
    },
  };
};

const mergeDraft = (
  current: RouteStepData,
  updates: Partial<RouteStepData>
): RouteStepData => ({
  ...current,
  ...updates,
  draft: {
    ...(current.draft ?? {}),
    ...(updates.draft ?? {}),
    processingConfig: updates.draft?.processingConfig
      ? { ...updates.draft.processingConfig }
      : current.draft?.processingConfig
      ? { ...current.draft.processingConfig }
      : undefined,
  },
  tags: (updates.tags ?? current.tags ?? []) as TagId[],
  processingConfig: updates.processingConfig
    ? { ...updates.processingConfig }
    : current.processingConfig
    ? { ...current.processingConfig }
    : undefined,
});

const hasRouteDetails = (data?: RouteStepData): boolean => {
  const wc = data as RouteStepData | undefined;
  const draft = wc?.draft;
  const routeType = draft && typeof (draft as Record<string, unknown>).routeType === 'string'
    ? (draft as Record<'routeType', string>).routeType
    : undefined;
  const transportModes = Array.isArray((draft as Record<string, unknown>).transportModes)
    ? ((draft as { transportModes: string[] }).transportModes)
    : [];
  return Boolean(routeType && transportModes.length > 0);
};

const startRouteBatch = async (data: RouteStepData, _context: StartBatchContext) => {
  const draft = data?.draft ?? {};
  const hasEssentials = Boolean(
    typeof draft.name === 'string' &&
      draft.name.trim() &&
      draft.routeType &&
      Array.isArray(draft.transportModes) &&
      draft.transportModes.length > 0
  );

  if (!hasEssentials) {
    notify.info('Complete the required route settings before starting a build.');
    return;
  }

  notify.info('Route batch launch is not yet implemented in this dialog.');
};

registry.registerConfigProvider<RouteStepData>({
  nodeType: 'route',
  getCreateStepConfigs(): PluginStepConfig<RouteStepData>[] {
    const t = routeTranslations;
    return [
      {
        id: 'route-details',
        label: 'Route Settings',
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <RouteDetailsStep
              draft={draft as unknown as RouteDraft}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, updates as Partial<RouteStepData>))}
              onValidationChange={p.setValid}
            />
          );
        },
        validate: hasRouteDetails,
      },
      {
        id: 'route-selection',
        label: t.en.routeSelection.title,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <RouteSelectionStep
              draft={draft as unknown as RouteDraft}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, updates as Partial<RouteStepData>))}
              onValidationChange={p.setValid}
            />
          );
        },
        validate: () => true,
      },
      {
        id: 'processing',
        label: 'Processing',
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <RouteProcessingStep
              draft={draft as unknown as RouteDraft}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, updates as Partial<RouteStepData>))}
              onValidationChange={p.setValid}
            />
          );
        },
        validate: () => true,
      },
      {
        id: 'build',
        label: 'Build',
        optional: true,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return <RouteBuildStep draft={draft as unknown as RouteDraft} />;
        },
        capabilities: {
          canStartBatch: (data: RouteStepData) => {
            const draft = data?.draft ?? {};
            const hasEssentials = Boolean(
              typeof draft.name === 'string' &&
                draft.name.trim() &&
                draft.routeType &&
                Array.isArray(draft.transportModes) &&
                draft.transportModes.length > 0
            );
            return hasEssentials;
          },
          startBatch: (data, context) => startRouteBatch(data as RouteStepData, context),
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
