import { PluginStepRegistry, type PluginStepProps } from '@hierarchidb/plugin-base';
import type { NodeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import type { LocationEntity } from '../../common/types/index.js';
import { LocationDataSourceStep } from './steps/LocationDataSourceStep.js';
import { LocationSelectionStep } from './steps/LocationSelectionStep.js';
import { LocationBatchParametersStep } from './steps/LocationBatchParametersStep.js';
import { LocationMapPreviewStep } from './steps/LocationMapPreviewStep.js';
import { i18n } from '@hierarchidb/ui-i18n';
import { getLocationDB } from '@hierarchidb/location-store';

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

const canProceedFromDataSource = (data?: LocationStepData): boolean => {
  const source = data?.dataSource;
  if (!source) return false;
  if (source === 'ide-gsm') {
    return Boolean(data?.ideGsmSourceUrl);
  }
  return true;
};

const hasSelection = (data?: LocationStepData): boolean => {
  const selected = data?.selectedArrayByCountries ?? {};
  return Object.values(selected).some((row) => Array.isArray(row) && row.some(Boolean));
};

const isLocationBuildPersisted = async (data?: Partial<LocationEntity>): Promise<boolean> => {
  const nodeId = data?.nodeId as NodeId | undefined;
  if (!nodeId) return Boolean(data?.processingStatus === 'completed');
  const db = getLocationDB();
  const count = await db.features.where('nodeId').equals(nodeId).count();
  if (count > 0) return true;
  return data?.processingStatus === 'completed';
};

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
        id: 'batch-parameters',
        label: String(i18n.t('steps.batchParameters.label', { ns: 'location-plugin', defaultValue: 'Style Config' })),
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          return (
            <LocationBatchParametersStep
              draft={draft}
              onUpdate={(updates) => p.onChange(mergeData(draft, updates))}
              disabled={Boolean(p.disabled)}
              nodeId={p.nodeId as NodeId | undefined}
            />
          );
        },
        validate: () => true,
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
              nodeId={p.nodeId as unknown as NodeId | undefined}
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
