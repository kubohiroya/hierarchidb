import { PluginStepRegistry, type StepComponentProps, type PluginStepConfig, type StartBatchContext } from '@hierarchidb/plugin-base';
import type { NodeId } from '@hierarchidb/common-types';
import {
  BasicInfoStep as SharedBasicInfoStep,
  type BasicInfoData,
} from '@hierarchidb/ui-plugin-basic-info';
import type { RouteDraft, TagId } from '../../common/types/index.js';
import { createRouteDraftBase } from '../../common/utils/draft.js';
import { translations as routeTranslations } from '../../common/i18n/index.js';
import { RouteSelectionStep } from '../../common/components/RouteSelectionStep.js';
import { RouteProcessingStep } from '../../common/components/RouteProcessingStep.js';
import { RouteDetailsStep } from '../../common/components/RouteDetailsStep.js';
import { RouteBuildStep } from './steps/RouteBuildStep.js';
import { notify } from '@hierarchidb/components';

const registry = PluginStepRegistry.getInstance();

type StepProps = StepComponentProps<RouteDraft>;

const ensureDraft = (data?: StepComponentProps['data']): RouteDraft => {
  const fallbackId = 'route-draft' as NodeId;
  if (data && typeof data === 'object') {
    const cast = data as RouteDraft;
    return createRouteDraftBase(
      (cast.treeNodeId ?? (cast as { id?: string }).id ?? fallbackId) as NodeId,
      {
        ...cast.draft,
        name: cast.draft?.name ?? '',
        description: cast.draft?.description ?? '',
        tags: cast.tags,
      },
      (cast as { parentId?: NodeId }).parentId
    );
  }
  return createRouteDraftBase(fallbackId, {}, undefined);
};

const mergeDraft = (
  current: RouteDraft,
  updates: Partial<RouteDraft>
): RouteDraft => ({
  ...current,
  ...updates,
  draft: {
    ...(current.draft ?? {}),
    ...(updates.draft ?? {}),
  },
  tags: (updates.tags ?? current.tags ?? []) as TagId[],
});

const hasRouteDetails = (data?: RouteDraft): boolean => {
  const wc = data as RouteDraft | undefined;
  const draft = wc?.draft;
  const routeType = draft && typeof (draft as Record<string, unknown>).routeType === 'string'
    ? (draft as Record<'routeType', string>).routeType
    : undefined;
  const transportModes = Array.isArray((draft as Record<string, unknown>).transportModes)
    ? ((draft as { transportModes: string[] }).transportModes)
    : [];
  return Boolean(routeType && transportModes.length > 0);
};

const startRouteBatch = async (data: RouteDraft, _context: StartBatchContext) => {
  const draft = data?.draft ?? {};
  const hasEssentials = Boolean(
    draft.name?.trim() &&
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

registry.registerConfigProvider<RouteDraft>({
  nodeType: 'route',
  getCreateStepConfigs(): PluginStepConfig<RouteDraft>[] {
    const t = routeTranslations;
    return [
      {
        id: 'basic-info',
        label: t.en.basicInfo.title,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <SharedBasicInfoStep
              name={draft.draft?.name ?? ''}
              description={draft.draft?.description ?? ''}
              tags={(draft.tags ?? []) as string[]}
              mode={p.mode}
              validate={({ name }) => (name.trim().length ? null : t.en.errors.nameRequired)}
              onChange={(value: BasicInfoData) =>
                p.onChange(
                  mergeDraft(draft, {
                    draft: {
                      ...draft.draft,
                      name: value.name,
                      description: value.description,
                    },
                    tags: (value.tags ?? []).map((tag) => tag as unknown as TagId),
                  })
                )
              }
            />
          );
        },
        validate: (data?: RouteDraft) => Boolean(data?.draft?.name?.trim()),
      },
      {
        id: 'route-details',
        label: 'Route Settings',
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <RouteDetailsStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, updates))}
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
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, updates))}
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
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, updates))}
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
          return <RouteBuildStep draft={draft} />;
        },
        capabilities: {
          canStartBatch: (data: RouteDraft) => {
            const draft = data?.draft ?? {};
            const hasEssentials = Boolean(
              draft.name?.trim() &&
                draft.routeType &&
                Array.isArray(draft.transportModes) &&
                draft.transportModes.length > 0
            );
            return hasEssentials;
          },
          startBatch: (data, context) => startRouteBatch(data, context),
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
