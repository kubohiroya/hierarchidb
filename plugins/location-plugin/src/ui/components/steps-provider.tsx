import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/plugin-base';
import type { NodeId } from '@hierarchidb/common-types';
import type { LocationWorkingCopy } from '../../common/types/index.js';
import { translations as locationTranslations } from '../../common/i18n/index.js';
import { LocationDataSourceStep } from '../../common/components/steps/LocationDataSourceStep.js';
import { LocationLicenseStep } from '../../common/components/steps/LocationLicenseStep.js';
import { LocationSelectionStep } from '../../common/components/steps/LocationSelectionStep.js';
import { LocationBatchParametersStep } from '../../common/components/steps/LocationBatchParametersStep.js';
import { LocationMapPreviewStep } from '../../common/components/steps/LocationMapPreviewStep.js';
import { LocationBuildStep } from './steps/LocationBuildStep.js';

const registry = PluginStepRegistry.getInstance();

const ensureWorkingCopy = (data?: StepComponentProps['data']): LocationWorkingCopy => {
  if (data && typeof data === 'object') {
    const cast = data as LocationWorkingCopy;
    return {
      ...cast,
      treeNodeId: cast.treeNodeId ?? (cast.id as NodeId) ?? ('' as NodeId),
      draft: { ...(cast.draft ?? {}) },
    } satisfies LocationWorkingCopy;
  }
  return {
    treeNodeId: '' as NodeId,
    draft: {},
    createdAt: Date.now() as unknown as number,
    updatedAt: Date.now() as unknown as number,
  } as LocationWorkingCopy;
};

const mergeWorkingCopy = (
  current: LocationWorkingCopy,
  updates: Partial<LocationWorkingCopy>
): LocationWorkingCopy => ({
  ...current,
  ...updates,
  draft: {
    ...(current.draft ?? {}),
    ...(updates.draft ?? {}),
  },
});

type StepProps = StepComponentProps & { data: LocationWorkingCopy };

type Validator = (data?: Record<string, unknown>) => boolean | Promise<boolean>;

const hasSelection = (data?: Record<string, unknown>): boolean => {
  const wc = data as LocationWorkingCopy | undefined;
  const matrix = wc?.draft?.selectionMatrix;
  if (!Array.isArray(matrix)) return false;
  return matrix.some((row) => Array.isArray(row) && row.some(Boolean));
};

registry.registerConfigProvider<LocationWorkingCopy>({
  nodeType: 'location',
  getCreateStepConfigs() {
    const t = locationTranslations;
    return [
      {
        id: 'data-source',
        label: t.en.dialog.dataSourceLabel,
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data);
          return (
            <LocationDataSourceStep
              workingCopy={workingCopy}
              onUpdate={(updates) => p.onChange(mergeWorkingCopy(workingCopy, updates))}
            />
          );
        },
        validate: ((data?: Record<string, unknown>) => {
          const wc = data as LocationWorkingCopy | undefined;
          return Boolean(wc?.draft?.dataSource);
        }) as Validator,
      },
      {
        id: 'license',
        label: t.en.dialog.licenseAgreementLabel,
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data);
          return (
            <LocationLicenseStep
              workingCopy={workingCopy}
              onUpdate={(updates) => p.onChange(mergeWorkingCopy(workingCopy, updates))}
            />
          );
        },
        validate: ((data?: Record<string, unknown>) => {
          const wc = data as LocationWorkingCopy | undefined;
          return Boolean(wc?.draft?.licenseAgreement);
        }) as Validator,
      },
      {
        id: 'selection',
        label: t.en.selection.title,
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data);
          return (
            <LocationSelectionStep
              workingCopy={workingCopy}
              onUpdate={(updates) => p.onChange(mergeWorkingCopy(workingCopy, updates))}
            />
          );
        },
        validate: hasSelection,
      },
      {
        id: 'batch-parameters',
        label: t.en.panel.processingSettings,
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data);
          return (
            <LocationBatchParametersStep
              workingCopy={workingCopy}
              onUpdate={(updates) => p.onChange(mergeWorkingCopy(workingCopy, updates))}
            />
          );
        },
        validate: () => true,
      },
      {
        id: 'map-preview',
        label: t.en.mapPreview?.title ?? 'Map Preview',
        optional: true,
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data);
          return <LocationMapPreviewStep workingCopy={workingCopy} />;
        },
        validate: () => true,
      },
      {
        id: 'build',
        label: t.en.build?.title ?? 'Build',
        optional: true,
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data);
          return (
            <LocationBuildStep
              nodeId={p.nodeId as NodeId}
              workingCopy={workingCopy}
            />
          );
        },
        capabilities: {
          canStartBatch: (data?: Record<string, unknown>) => {
            const wc = data as LocationWorkingCopy | undefined;
            return Boolean(wc?.treeNodeId && wc?.draft?.dataSource && wc?.draft?.licenseAgreement);
          },
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
