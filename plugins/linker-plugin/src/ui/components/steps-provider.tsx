import { PluginStepRegistry, type PluginStepConfig, type StepComponentProps, type StepData } from '@hierarchidb/plugin-base';
import type { NodeId } from '@hierarchidb/common-types';
import { ResourcePicker, type ResourceSummary } from '../steps/ResourcePicker.js';
import { AggregatedList } from '../steps/AggregatedList.js';
import { MapPreview } from '../steps/MapPreview.js';

type LinkerStepData = StepData & {
  likedNodeIds?: string[];
};

type LinkerStepProps = StepComponentProps<LinkerStepData>;

const registry = PluginStepRegistry.getInstance();

const toSelectionSet = (value?: LinkerStepData['likedNodeIds']): Set<string> => {
  if (!value) return new Set<string>();
  return new Set<string>(value);
};

const toResourceSummaries = (value: Set<string>): ResourceSummary[] =>
  Array.from(value).map((id) => ({ nodeId: String(id) }));

const createLinkerStepConfigs = (): PluginStepConfig<LinkerStepData>[] => [
  {
    id: 'resources',
    label: 'Select Resources',
    componentFactory: (props: LinkerStepProps) => {
      const selection = toSelectionSet(props.data?.likedNodeIds);
      return (
        <ResourcePicker
          value={selection}
          onChange={(nextSet: Set<string>) =>
            props.onChange({ ...(props.data ?? {}), likedNodeIds: Array.from(nextSet) })}
          notice="Select resources from the console. Multiple selection is allowed. Data is read-only."
        />
      );
    },
    validate: (data?: LinkerStepData) => toSelectionSet(data?.likedNodeIds).size > 0,
  },
  {
    id: 'aggregated',
    label: 'Aggregated Paths',
    componentFactory: (props: LinkerStepProps) => {
      const selection = toSelectionSet(props.data?.likedNodeIds);
      const selected = toResourceSummaries(selection);
      return <AggregatedList selfNodeId={String(props.nodeId ?? '') as NodeId} selected={selected} />;
    },
    validate: () => true,
  },
  {
    id: 'preview',
    label: 'Map Preview',
    componentFactory: (props: LinkerStepProps) => {
      const selection = toSelectionSet(props.data?.likedNodeIds);
      const items = toResourceSummaries(selection);
      return <MapPreview items={items} />;
    },
    validate: () => true,
  },
];

registry.registerConfigProvider<LinkerStepData>({
  nodeType: 'linker',
  getCreateStepConfigs: createLinkerStepConfigs,
  getEditStepConfigs() {
    return createLinkerStepConfigs();
  },
});
