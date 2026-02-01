import { PluginStepRegistry, type PluginStepProps } from '@hierarchidb/plugin-base';
import { toNodeId, type NodeId } from '@hierarchidb/core-types';
import type { TreeNodeMetadata } from '@hierarchidb/tree-api';
import type { LocationEntity } from '../../common/types/index.js';
import { LocationDataSourceStep } from './steps/LocationDataSourceStep.js';
import { LocationSelectionStep } from './steps/LocationSelectionStep.js';
import { LocationMapPreviewStep } from './steps/LocationMapPreviewStep.js';
import { i18n } from '@hierarchidb/ui-i18n';

const registry = PluginStepRegistry.getInstance();

// Step payload = Partial<LocationEntity>; treeNode metadataはホスト Basic Info で管理する。
type LocationStepData = Partial<LocationEntity> & {
  draftMetadata?: TreeNodeMetadata | null;
};

const ensureData = (data?: LocationStepData): LocationStepData => ({
  ...(data ?? {}),
  draftMetadata: (data?.draftMetadata ?? { name: '', description: '', tags: [] }) as TreeNodeMetadata,
});

const mergeData = (
  current: LocationStepData,
  updates: Partial<LocationStepData>
): LocationStepData => ({
  ...current,
  ...updates,
});

type StepProps = PluginStepProps<LocationStepData>;

const LICENSE_REQUIRED = false;

const resolveNodeId = (nodeId?: string): NodeId | undefined => (
  typeof nodeId === 'string' && nodeId.length > 0 ? toNodeId(nodeId) : undefined
);

const canProceedFromDataSource = (data?: LocationStepData): boolean => {
  const source = data?.dataSource;
  if (!source) return false;
  if (source === 'ide-gsm') {
    const sources = data?.ideGsmSources ?? [];
    if (sources.length > 0) return true;
    return Boolean(data?.tabularSourceId);
  }
  return true;
};

const hasSelection = (data?: LocationStepData): boolean => {
  const selected = data?.selectedArrayByCountries ?? {};
  return Object.values(selected).some((row) => Array.isArray(row) && row.some(Boolean));
};

const isLocationBuildPersisted = async (data?: Partial<LocationEntity>): Promise<boolean> => (
  Boolean(data?.processingStatus === 'completed')
);

registry.registerConfigProvider<LocationStepData>({
  nodeType: 'location',
  getCreateStepConfigs() {
    return [
      {
        id: 'data-source',
        label: String(i18n.t('steps.dataSource.label', { ns: 'location-plugin', defaultValue: 'Data Source' })),
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return (
            <LocationDataSourceStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeData(draft, updates))}
              licenseRequired={LICENSE_REQUIRED}
              disabled={Boolean(p.disabled)}
              nodeId={resolveNodeId(p.nodeId)}
              uiState={p.uiState as Record<string, unknown> | undefined}
              onUiStateChange={(next) => p.onUiStateChange?.(next)}
            />
          );
        },
        validate: (data?: LocationStepData) => canProceedFromDataSource(data),
      },
      {
        id: 'selection',
        label: String(i18n.t('steps.selection.label', { ns: 'location-plugin', defaultValue: 'Location Selection' })),
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return (
            <LocationSelectionStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeData(draft, updates))}
            />
          );
        },
        validate: (data?: LocationStepData) => hasSelection(data),
      },
      {
        id: 'map-preview',
        label: String(i18n.t('steps.mapPreview.label', { ns: 'location-plugin', defaultValue: 'Map Preview' })),
        optional: true,
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return (
            <LocationMapPreviewStep
              draft={draft}
              nodeId={resolveNodeId(p.nodeId)}
              onUpdate={(updates) => p.onChange(mergeData(draft, updates))}
            />
          );
        },
        validate: (data?: LocationStepData) => isLocationBuildPersisted(data),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
