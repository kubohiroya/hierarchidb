import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/plugin-base';
import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import { BasicInfoStep as SharedBasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import type { LocationWorkingCopy } from '../../common/types/index.js';
import { translations as locationTranslations } from '../../common/i18n/index.js';
import { LocationDataSourceStep } from '../../common/components/steps/LocationDataSourceStep.js';
import { LocationLicenseStep } from '../../common/components/steps/LocationLicenseStep.js';
import { LocationSelectionStep } from '../../common/components/steps/LocationSelectionStep.js';
import { LocationBatchParametersStep } from '../../common/components/steps/LocationBatchParametersStep.js';
import { LocationMapPreviewStep } from '../../common/components/steps/LocationMapPreviewStep.js';
import { LocationBuildStep } from './steps/LocationBuildStep.js';

const registry = PluginStepRegistry.getInstance();

const ensureWorkingCopy = (data?: LocationWorkingCopy): LocationWorkingCopy => {
  if (data) {
    return {
      ...data,
      treeNodeId: data.treeNodeId ?? ('' as NodeId),
      draft: { ...(data.draft ?? {}) },
      createdAt: data.createdAt ?? (Date.now() as Timestamp),
      updatedAt: data.updatedAt ?? (Date.now() as Timestamp),
      tags: data.tags ?? [],
    } satisfies LocationWorkingCopy;
  }
  return {
    treeNodeId: '' as NodeId,
    draft: {},
    createdAt: Date.now() as Timestamp,
    updatedAt: Date.now() as Timestamp,
    tags: [],
  } satisfies LocationWorkingCopy;
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

type StepProps = StepComponentProps<LocationWorkingCopy>;

const hasSelection = (data?: LocationWorkingCopy): boolean => {
  const matrix = data?.draft?.selectionMatrix;
  if (!Array.isArray(matrix)) return false;
  return matrix.some((row) => Array.isArray(row) && row.some(Boolean));
};

registry.registerConfigProvider<LocationWorkingCopy>({
  nodeType: 'location',
  getCreateStepConfigs() {
    const t = locationTranslations;
    return [
      {
        id: 'basic-info',
        label: t.en.basicInfo.title,
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data);
          return (
            <SharedBasicInfoStep
              name={workingCopy.draft?.name ?? ''}
              description={workingCopy.draft?.description ?? ''}
              tags={workingCopy.tags ?? []}
              mode={p.mode}
              tagSuggestions={t.en.basicInfo.tagSuggestions ?? []}
              validate={({ name }) => (name.trim().length ? null : t.en.errors.nameRequired)}
              onChange={(value: BasicInfoData) => {
                p.onChange(
                  mergeWorkingCopy(workingCopy, {
                    draft: {
                      ...workingCopy.draft,
                      name: value.name,
                      description: value.description,
                    },
                    tags: value.tags,
                  })
                );
              }}
            />
          );
        },
        validate: (data?: LocationWorkingCopy) => Boolean(data?.draft?.name?.trim()),
      },
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
        validate: (data?: LocationWorkingCopy) => Boolean(data?.draft?.dataSource),
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
        validate: (data?: LocationWorkingCopy) => Boolean(data?.draft?.licenseAgreement),
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
        validate: (data?: LocationWorkingCopy) => hasSelection(data),
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
        label: t.en.build?.actionLabel ?? 'Build',
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
          canStartBatch: (data: LocationWorkingCopy) =>
            Boolean(data?.treeNodeId && data?.draft?.dataSource && data?.draft?.licenseAgreement),
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
