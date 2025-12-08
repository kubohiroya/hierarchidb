import { PluginStepRegistry, type PluginStepConfig, type StepComponentProps, type StepData } from '@hierarchidb/plugin-base';
import type { NodeId } from '@hierarchidb/common-types';
import type { LinkerDraft } from '../../common/types/index.js';
import { ResourcePicker, type ResourceSummary } from '../steps/ResourcePicker.js';
import { AggregatedList } from '../steps/AggregatedList.js';
import { MapPreview } from '../steps/MapPreview.js';
import { useTranslation as getTranslation } from '../../common/i18n/index.js';

type LinkerStepData = StepData & LinkerDraft;

type LinkerStepProps = StepComponentProps<LinkerStepData>;

const registry = PluginStepRegistry.getInstance();

const toSelectionSet = (value?: LinkerStepData['draftData'] extends { linkedNodeIds?: NodeId[] } ? LinkerStepData['draftData']['linkedNodeIds'] : string[]): Set<string> => {
  if (!value) return new Set<string>();
  return new Set<string>(value);
};

const toResourceSummaries = (value: Set<string>): ResourceSummary[] =>
  Array.from(value).map((id) => ({ nodeId: String(id) }));

const createLinkerStepConfigs = (): PluginStepConfig<LinkerStepData>[] => {
  const { t } = getTranslation();
  return [
    {
      id: 'resources',
      label: t('steps.resources.label', 'Select Resources'),
      componentFactory: (props: LinkerStepProps) => {
        const selection = toSelectionSet(props.data?.draftData?.linkedNodeIds);
        return (
          <ResourcePicker
            value={selection}
            onChange={(nextSet: Set<string>) =>
              props.onChange({
                ...(props.data ?? {}),
                draftData: {
                  ...(props.data?.draftData ?? {}),
                  linkedNodeIds: Array.from(nextSet) as NodeId[],
                },
              })}
            notice={t('resourcePicker.notice', 'Select resources from the console. Multiple selection is allowed. Data is read-only.')}
          />
        );
      },
      validate: (data?: LinkerStepData) => toSelectionSet(data?.draftData?.linkedNodeIds).size > 0,
    },
    {
      id: 'aggregated',
      label: t('steps.aggregated.label', 'Aggregated Paths'),
      componentFactory: (props: LinkerStepProps) => {
        const selection = toSelectionSet(props.data?.draftData?.linkedNodeIds);
        const selected = toResourceSummaries(selection);
        return <AggregatedList selfNodeId={String(props.nodeId ?? '') as NodeId} selected={selected} />;
      },
      validate: () => true,
    },
    {
      id: 'preview',
      label: t('steps.preview.label', 'Map Preview'),
      componentFactory: (props: LinkerStepProps) => {
        const selection = toSelectionSet(props.data?.draftData?.linkedNodeIds);
        const items = toResourceSummaries(selection);
        return <MapPreview items={items} />;
      },
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
