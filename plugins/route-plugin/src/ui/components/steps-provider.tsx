import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/plugin-base';
import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import {
  BasicInfoStep as SharedBasicInfoStep,
  type BasicInfoData,
} from '@hierarchidb/ui-plugin-basic-info';
import type { RouteWorkingCopy } from '../../common/types/index.js';
import { translations as routeTranslations } from '../../common/i18n/index.js';
import { RouteSelectionStep } from '../../common/components/RouteSelectionStep.js';
import { RouteProcessingStep } from '../../common/components/RouteProcessingStep.js';
import { RouteDetailsStep } from '../../common/components/RouteDetailsStep.js';
import { RouteBuildStep } from './steps/RouteBuildStep.js';

const registry = PluginStepRegistry.getInstance();

type StepProps = StepComponentProps & { data: RouteWorkingCopy };

const ensureWorkingCopy = (data?: StepComponentProps['data']): RouteWorkingCopy => {
  if (data && typeof data === 'object') {
    const cast = data as RouteWorkingCopy;
    return {
      ...cast,
      treeNodeId: cast.treeNodeId ?? (cast.id as NodeId) ?? ('' as NodeId),
      draft: { ...(cast.draft ?? {}) },
      tags: cast.tags ?? [],
      createdAt: cast.createdAt ?? (Date.now() as Timestamp),
      updatedAt: cast.updatedAt ?? (Date.now() as Timestamp),
    } satisfies RouteWorkingCopy;
  }
  return {
    treeNodeId: '' as NodeId,
    draft: {},
    tags: [],
    createdAt: Date.now() as Timestamp,
    updatedAt: Date.now() as Timestamp,
  } as RouteWorkingCopy;
};

const mergeWorkingCopy = (
  current: RouteWorkingCopy,
  updates: Partial<RouteWorkingCopy>
): RouteWorkingCopy => ({
  ...current,
  ...updates,
  draft: {
    ...(current.draft ?? {}),
    ...(updates.draft ?? {}),
  },
  tags: updates.tags ?? current.tags ?? [],
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
        id: 'basic-info',
        label: t.en.basicInfo.title,
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data);
          return (
            <SharedBasicInfoStep
              name={workingCopy.draft?.name ?? ''}
              description={workingCopy.draft?.description ?? ''}
              tags={workingCopy.tags ?? []}
              mode={p.mode}
              validate={({ name }) => (name.trim().length ? null : t.en.errors.nameRequired)}
              onChange={(value: BasicInfoData) =>
                p.onChange(
                  mergeWorkingCopy(workingCopy, {
                    draft: {
                      ...workingCopy.draft,
                      name: value.name,
                      description: value.description,
                    },
                    tags: value.tags,
                  })
                )
              }
            />
          );
        },
        validate: (data?: RouteWorkingCopy) => Boolean(data?.draft?.name?.trim()),
      },
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
      {
        id: 'build',
        label: 'Build',
        optional: true,
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data);
          return <RouteBuildStep workingCopy={workingCopy} />;
        },
        capabilities: {
          canStartBatch: (data: RouteWorkingCopy) => {
            const draft = data?.draft ?? {};
            const hasEssentials = Boolean(
              draft.name?.trim() &&
                draft.routeType &&
                Array.isArray(draft.transportModes) &&
                draft.transportModes.length > 0
            );
            return hasEssentials;
          },
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
