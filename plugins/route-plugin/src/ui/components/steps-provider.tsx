import {
  PluginStepRegistry,
  type StepComponentProps,
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
import { RouteDetailsStep } from './steps/RouteDetailsStep.js';
import { RouteBuildStep } from './steps/RouteBuildStep.js';
import { notify } from '@hierarchidb/components';
import { BasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';

const registry = PluginStepRegistry.getInstance();

type RouteStepData = StepData & RouteUpdaterPayload;

type StepProps = StepComponentProps<RouteStepData>;

const ensureDraft = (data?: StepComponentProps['data']): RouteStepData => {
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

const hasRouteDetails = (data?: RouteStepData): boolean => {
  const draftData = data?.draftData ?? {};
  const routeType = typeof (draftData as Record<string, unknown>).routeType === 'string'
    ? (draftData as Record<'routeType', string>).routeType
    : undefined;
  const transportModes = Array.isArray((draftData as Record<string, unknown>).transportModes)
    ? ((draftData as { transportModes: string[] }).transportModes)
    : [];
  return Boolean(routeType && transportModes.length > 0);
};

const startRouteBatch = async (data: RouteStepData, _context: StartBatchContext) => {
  const { t } = getTranslation();
  const draft = data?.draftData ?? {};
  const hasEssentials = Boolean(
    typeof draft.name === 'string' &&
      draft.name.trim() &&
      draft.routeType &&
      Array.isArray(draft.transportModes) &&
      draft.transportModes.length > 0
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
        id: 'basic-info',
        label: t('steps.basicInfo.label', 'Basic Info'),
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          const meta = (draft.draftMetadata ?? { name: '', description: '', tags: [] }) as {
            name?: string;
            description?: string;
            tags?: string[];
          };
          return (
            <BasicInfoStep
              name={meta.name ?? ''}
              description={meta.description ?? ''}
              tags={meta.tags ?? []}
              mode={p.mode}
              onChange={({ name, description, tags }: BasicInfoData) =>
                p.onChange({
                  ...draft,
                  draftMetadata: { ...meta, name, description, tags: tags ?? [] },
                })
              }
              validate={({ name }) => (name.trim().length ? null : 'Name is required')}
            />
          );
        },
        validate: (data?: RouteStepData) => Boolean(data?.draftMetadata?.name?.trim()),
      },
      {
        id: 'route-details',
        label: t('steps.details.label', 'Route Settings'),
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <RouteDetailsStep
              draft={draft as unknown as RouteUpdaterPayload}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, { draftData: updates }))}
              onValidationChange={p.setValid}
            />
          );
        },
        validate: hasRouteDetails,
      },
      {
        id: 'route-selection',
        label: t('steps.selection.label', 'Route Selection'),
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <RouteSelectionStep
              draft={draft as unknown as RouteUpdaterPayload}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, { draftData: updates }))}
              onValidationChange={p.setValid}
            />
          );
        },
        validate: () => true,
      },
      {
        id: 'processing',
        label: t('steps.processing.label', 'Processing'),
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <RouteProcessingStep
              draft={draft as unknown as RouteUpdaterPayload}
              onUpdate={(updates) => p.onChange(mergeDraft(draft, { draftData: updates }))}
              onValidationChange={p.setValid}
            />
          );
        },
        validate: () => true,
      },
      {
        id: 'build',
        label: t('steps.build.label', 'Build'),
        optional: true,
        componentFactory: (p: StepProps) => {
          const draft = ensureDraft(p.data);
          return <RouteBuildStep draft={draft as unknown as RouteUpdaterPayload} />;
        },
        capabilities: {
          canStartBatch: (data: RouteStepData) => {
            const draft = data?.draftData ?? {};
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
