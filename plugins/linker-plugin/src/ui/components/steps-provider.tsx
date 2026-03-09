import { PluginStepRegistry, type PluginStepConfig, type PluginStepProps, type StepData } from '@hierarchidb/plugin-base';
import type { NodeId } from '@hierarchidb/core-types';
import type { LinkerDraft } from '~/common/types/index';
import { ResourcePicker } from '~/ui/steps/ResourcePicker';
import { AggregatedList } from '~/ui/steps/AggregatedList';
import { MapPreview } from '~/ui/steps/MapPreview';
import { i18n, useTranslation } from '@hierarchidb/ui-i18n';
import { useLinkerSteps } from './hooks/useLinkerSteps.js';

type LinkerStepData = StepData & LinkerDraft;

type LinkerStepProps = PluginStepProps<LinkerStepData>;

const registry = PluginStepRegistry.getInstance();

const createDraftUpdater = (initial: LinkerStepData, onChange: LinkerStepProps['onChange']) => {
  let latestDraft: LinkerStepData = initial ?? {};
  const serializeComparable = (value: unknown): string => {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  };
  let latestSignature = serializeComparable(latestDraft);

  return (next: Partial<LinkerStepData>) => {
    const nextDraft: LinkerStepData = {
      ...latestDraft,
      ...next,
      draftData: {
        ...(latestDraft.draftData ?? {}),
        ...(next.draftData ?? {}),
      },
    };
    const nextSignature = serializeComparable(nextDraft);
    if (nextSignature === latestSignature) {
      return;
    }
    latestDraft = nextDraft;
    latestSignature = nextSignature;
    onChange(nextDraft);
  };
};

const ResourcesStepWrapper = (props: LinkerStepProps) => {
  const { ensureDraft, toSelectionSet } = useLinkerSteps();
  const draft = ensureDraft(props.data);
  const {t} = useTranslation('linker-plugin');
  const selection = toSelectionSet(props.data?.draftData?.linkedNodeIds);
  const handleUpdate = createDraftUpdater(draft, props.onChange);
  return (
    <ResourcePicker
      value={selection}
      onChange={(nextSet: Set<string>) =>
        handleUpdate({
          draftData: {
            ...(draft?.draftData ?? {}),
            linkedNodeIds: Array.from(nextSet) as NodeId[],
          },
        })}
      notice={t('resourcePicker.notice', 'Select resources from the console. Multiple selection is allowed. Data is read-only.')}
    />
  );
};

const AggregatedStepWrapper = (props: LinkerStepProps) => {
  const { toSelectionSet, toResourceSummaries } = useLinkerSteps();
  const selection = toSelectionSet(props.data?.draftData?.linkedNodeIds);
  const selected = toResourceSummaries(selection);
  return <AggregatedList selfNodeId={String(props.nodeId ?? '') as NodeId} selected={selected} />;
};

const PreviewStepWrapper = (props: LinkerStepProps) => {
  const { toSelectionSet, toResourceSummaries } = useLinkerSteps();
  const selection = toSelectionSet(props.data?.draftData?.linkedNodeIds);
  const items = toResourceSummaries(selection);
  return <MapPreview items={items} />;
};

const createLinkerStepConfigs = (): PluginStepConfig<LinkerStepData>[] => {
  const t = (key: string, fallback: string) =>
    String(i18n.t(key, { ns: 'linker-plugin', defaultValue: fallback }));

  return [
    {
      id: 'resources',
      label: t('steps.resources.label', 'Select Resources'),
      componentFactory: (props: LinkerStepProps) => <ResourcesStepWrapper {...props} />,
      validate: (data?: LinkerStepData) =>
        Array.isArray(data?.draftData?.linkedNodeIds) && data.draftData.linkedNodeIds.length > 0,
    },
    {
      id: 'aggregated',
      label: t('steps.aggregated.label', 'Aggregated Paths'),
      componentFactory: (props: LinkerStepProps) => <AggregatedStepWrapper {...props} />,
      validate: () => true,
    },
    {
      id: 'preview',
      label: t('steps.preview.label', 'Map Preview'),
      componentFactory: (props: LinkerStepProps) => <PreviewStepWrapper {...props} />,
      validate: () => true,
    },
  ];
};

registry.registerConfigProvider<LinkerStepData>({
  nodeType: 'linker',
  getCreateStepConfigs: createLinkerStepConfigs,
  getEditStepConfigs() {
    return createLinkerStepConfigs();
  },
});
