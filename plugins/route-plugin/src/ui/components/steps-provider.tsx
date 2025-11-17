import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/plugin-base';
import type { NodeId } from '@hierarchidb/common-types';
import type { RouteWorkingCopy } from '../../common/types/index.js';
import { translations as routeTranslations } from '../../common/i18n/index.js';
import { RouteSelectionStep } from '../../common/components/RouteSelectionStep.js';
import { RouteProcessingStep } from '../../common/components/RouteProcessingStep.js';
import { RouteDetailsStep } from '../../common/components/RouteDetailsStep.js';

const registry = PluginStepRegistry.getInstance();

type StepProps = StepComponentProps & { data: RouteWorkingCopy };

const ensureWorkingCopy = (data?: StepComponentProps['data']): RouteWorkingCopy => {
  if (data && typeof data === 'object') {
    const cast = data as RouteWorkingCopy;
    return {
      ...cast,
      treeNodeId: cast.treeNodeId ?? (cast.id as NodeId) ?? ('' as NodeId),
      draft: { ...(cast.draft ?? {}) },
    } satisfies RouteWorkingCopy;
  }
  return {
    treeNodeId: '' as NodeId,
    draft: {},
    createdAt: Date.now() as unknown as number,
    updatedAt: Date.now() as unknown as number,
  } as RouteWorkingCopy;
};

const mergeWorkingCopy = (current: RouteWorkingCopy, updates: Partial<RouteWorkingCopy>): RouteWorkingCopy => ({
  ...current,
  ...updates,
  draft: {
    ...(current.draft ?? {}),
    ...(updates.draft ?? {}),
  },
});

const hasRouteDetails = (data?: Record<string, unknown>): boolean => {
  const wc = data as RouteWorkingCopy | undefined;
  const draft = wc?.draft;
  const routeType = draft && typeof (draft as Record<string, unknown>).routeType === 'string'
    ? (draft as Record<'routeType', string>).routeType
    : undefined;
  const transportModes = Array.isArray((draft as Record<string, unknown>).transportModes)
    ? ((draft as { transportModes: string[] }).transportModes)
    : [];
  return Boolean(routeType && transportModes.length > 0);
};

registry.registerConfigProvider<RouteWorkingCopy>({
  nodeType: 'route',
  getCreateStepConfigs() {
    const t = routeTranslations;
    return [
      {
        id: 'route-details',
        label: t.en.routeDetails.title,
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data);
          return (
            <RouteDetailsStep
              workingCopy={workingCopy}
              onUpdate={(updates) => p.onChange(mergeWorkingCopy(workingCopy, updates))}
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
          const workingCopy = ensureWorkingCopy(p.data);
          return (
            <RouteSelectionStep
              workingCopy={workingCopy}
              onUpdate={(updates) => p.onChange(mergeWorkingCopy(workingCopy, updates))}
              onValidationChange={p.setValid}
            />
          );
        },
        validate: () => true,
      },
      {
        id: 'processing',
        label: t.en.processing.title,
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data);
          return (
            <RouteProcessingStep
              workingCopy={workingCopy}
              onUpdate={(updates) => p.onChange(mergeWorkingCopy(workingCopy, updates))}
              onValidationChange={p.setValid}
            />
          );
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
