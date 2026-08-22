import { type NodeId, toNodeId } from '@hierarchidb/core-types';
import { type PluginStepProps, PluginStepRegistry } from '@hierarchidb/plugin-base';
import { i18n } from '@hierarchidb/ui-i18n';
import type { LocationEntity } from '~/common/types/index';
import { LocationDataSourceStep } from './steps/LocationDataSourceStep.js';
import { LocationMapPreviewStep } from './steps/LocationMapPreviewStep.js';
import { LocationSelectionStep } from './steps/LocationSelectionStep.js';

const registry = PluginStepRegistry.getInstance();

// Step payload = Partial<LocationEntity>; treeNode metadataはホスト Basic Info で管理する。
type LocationStepData = Partial<LocationEntity>;

const ensureData = (data?: LocationStepData): LocationStepData => ({
  ...(data ?? {}),
});

const mergeData = (
  current: LocationStepData,
  updates: Partial<LocationStepData>
): LocationStepData => ({
  ...current,
  ...updates,
});

type DraftNormalizer<TData, TUpdate> = (current: TData, updates: TUpdate) => TData;

const serializeComparable = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const createDraftUpdater = (
  initial: LocationStepData,
  onChange: StepProps['onChange'],
  merge: DraftNormalizer<LocationStepData, Partial<LocationStepData>> = mergeData
) => {
  let latestDraft = { ...(initial ?? {}) };
  let latestSignature = serializeComparable(latestDraft);

  return (updates: Partial<LocationStepData>) => {
    const nextDraft = merge(latestDraft, updates);
    const nextSignature = serializeComparable(nextDraft);
    if (nextSignature === latestSignature) {
      return;
    }
    latestDraft = nextDraft;
    latestSignature = nextSignature;
    onChange(nextDraft);
  };
};

type StepProps = PluginStepProps<LocationStepData>;

const LICENSE_REQUIRED = false;

const resolveNodeId = (nodeId?: string): NodeId | undefined =>
  typeof nodeId === 'string' && nodeId.length > 0 ? toNodeId(nodeId) : undefined;

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

const isMapPreviewReady = (data?: LocationStepData): boolean =>
  canProceedFromDataSource(data) && hasSelection(data);

registry.registerConfigProvider<LocationStepData>({
  nodeType: 'location',
  getCreateStepConfigs() {
    return [
      {
        id: 'data-source',
        label: String(
          i18n.t('steps.dataSource.label', { ns: 'location-plugin', defaultValue: 'Data Source' })
        ),
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          const handleUpdate = createDraftUpdater(draft, p.onChange);
          return (
            <LocationDataSourceStep
              draft={draft}
              onUpdate={handleUpdate}
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
        label: String(
          i18n.t('steps.selection.label', {
            ns: 'location-plugin',
            defaultValue: 'Location Selection',
          })
        ),
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          const handleUpdate = createDraftUpdater(draft, p.onChange);
          return <LocationSelectionStep draft={draft} onUpdate={handleUpdate} />;
        },
        validate: (data?: LocationStepData) => hasSelection(data),
      },
      {
        id: 'map-preview',
        label: String(
          i18n.t('steps.mapPreview.label', { ns: 'location-plugin', defaultValue: 'Map Preview' })
        ),
        optional: true,
        componentFactory: (p: StepProps) => {
          const draft = ensureData(p.data);
          const handleUpdate = createDraftUpdater(draft, p.onChange);
          return (
            <LocationMapPreviewStep
              draft={draft}
              nodeId={resolveNodeId(p.nodeId)}
              onUpdate={handleUpdate}
            />
          );
        },
        validate: (data?: LocationStepData) => isMapPreviewReady(data),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
