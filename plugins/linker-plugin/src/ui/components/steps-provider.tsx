import { PluginStepRegistry, type PluginStepConfig, type StepComponentProps, type StepData } from '@hierarchidb/plugin-base';
import type { NodeId } from '@hierarchidb/common-types';
import type { LinkerDraft } from '../../common/types/index.js';
import { ResourcePicker } from '../steps/ResourcePicker.js';
import { AggregatedList } from '../steps/AggregatedList.js';
import { MapPreview } from '../steps/MapPreview.js';
import { useTranslation as getTranslation } from '../../common/i18n/index.js';
import { useLinkerSteps } from './hooks/useLinkerSteps.js';
import { useTranslation } from '@hierarchidb/ui-i18n';

type LinkerStepData = StepData & LinkerDraft;

type LinkerStepProps = StepComponentProps<LinkerStepData>;

const registry = PluginStepRegistry.getInstance();

const ResourcesStepWrapper = (props: LinkerStepProps) => {
  const { ensureDraft, toSelectionSet } = useLinkerSteps();
  const draft = ensureDraft(props.data);
  const {t} = useTranslation();
  const selection = toSelectionSet(props.data?.draftData?.linkedNodeIds);
  return (
    <ResourcePicker
      value={selection}
      onChange={(nextSet: Set<string>) =>
        props.onChange({
          ...(draft ?? {}),
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
  const { t } = getTranslation();

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
