import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-plugin-dialog';
import type { NodeId } from '@hierarchidb/common-types';
import { ResourcePicker, type ResourceSummary } from '../steps/ResourcePicker.js';
import { AggregatedList } from '../steps/AggregatedList.js';
import { MapPreview } from '../steps/MapPreview.js';

type P = StepComponentProps & { data: { likedNodeIdSet?: Set<string> | string[] } };
const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider({
  nodeType: 'linker',
  getCreateStepConfigs() {
    return [
      {
        id: 'resources',
        label: 'Select Resources',
        componentFactory: (p: P) => (
          <ResourcePicker
            value={new Set<string>(Array.isArray(p.data?.likedNodeIdSet) ? (p.data!.likedNodeIdSet as string[]) : Array.from(p.data?.likedNodeIdSet || new Set<string>()))}
            onChange={(setLike: Set<string>) =>
              p.onChange({ ...(p.data || {}), likedNodeIdSet: new Set<string>(setLike) })}
            notice={'Select resources from the tree. Multiple selection is allowed. Data is read-only.'}
          />
        ),
        validate: (data?: { likedNodeIdSet?: Set<string> | string[] }) => {
          const s = data?.likedNodeIdSet;
          if (s instanceof Set) return s.size > 0;
          if (Array.isArray(s)) return s.length > 0;
          return false;
        },
      },
      {
        id: 'aggregated',
        label: 'Aggregated Paths',
        componentFactory: (p: P) => {
          const set = p.data?.likedNodeIdSet instanceof Set ? p.data.likedNodeIdSet : new Set<string>(Array.isArray(p.data?.likedNodeIdSet) ? p.data!.likedNodeIdSet as string[] : []);
          const selected: ResourceSummary[] = Array.from(set).map((id) => ({ nodeId: String(id) }));
          return <AggregatedList selfNodeId={String(p.nodeId) as NodeId} selected={selected} />;
        },
        validate: () => true,
      },
      {
        id: 'preview',
        label: 'Map Preview',
        componentFactory: (p: P) => {
          const set = p.data?.likedNodeIdSet instanceof Set ? p.data.likedNodeIdSet : new Set<string>(Array.isArray(p.data?.likedNodeIdSet) ? p.data!.likedNodeIdSet as string[] : []);
          const items: ResourceSummary[] = Array.from(set).map((id) => ({ nodeId: String(id) }));
          return <MapPreview items={items} />;
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs() { return this.getCreateStepConfigs(); },
});
