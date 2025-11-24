import { PluginStepRegistry, type StepComponentProps, type PluginStepConfig } from '@hierarchidb/plugin-base';
import {
  BasicInfoStep as SharedBasicInfoStep,
  type BasicInfoData,
} from '@hierarchidb/ui-plugin-basic-info';
import { SchemaSelectionStep } from './steps/SchemaSelectionStep.js';
import { PropertyMappingStep } from './steps/PropertyMappingStep.js';
import { ValidationConfigStep } from './steps/ValidationConfigStep.js';
import { DuplicateResolutionStep } from './steps/DuplicateResolutionStep.js';
import { PreviewTestStep } from './steps/PreviewTestStep.js';
import type {
  ResolverDraftEntity,
  SchemaInfo,
  MappingValidationResult,
  ResolverDraft,
} from '../../common/types/index.js';
import { ResolverBuildStep } from './steps/ResolverBuildStep.js';

const registry = PluginStepRegistry.getInstance();

type ResolverData = Partial<ResolverDraftEntity> & {
  sourceSchema?: SchemaInfo | null;
  targetSchema?: SchemaInfo | null;
  lastValidation?: MappingValidationResult | null;
};

type ResolverStepProps = StepComponentProps<ResolverDraft>;

const ensureDraft = (data?: ResolverData): ResolverDraft => {
  const draft = data ?? {};
  return {
    ...draft,
    tags: draft.tags ?? [],
    sourceSchema:
      draft.sourceSchema && typeof draft.sourceSchema === 'object'
        ? draft.sourceSchema
        : null,
    targetSchema:
      draft.targetSchema && typeof draft.targetSchema === 'object'
        ? draft.targetSchema
        : null,
    mappingRules: draft.mappingRules ?? [],
    validationRules: draft.validationRules ?? [],
    duplicateResolution: draft.duplicateResolution ?? { strategy: 'ignore' },
    dataTransformations: draft.dataTransformations ?? [],
    previewConfig: draft.previewConfig,
  } as ResolverDraft;
};

const mergeDraft = (
  current: ResolverDraft,
  updates: Partial<ResolverDraftEntity>
): ResolverDraft => ({
  ...current,
  ...updates,
  tags: updates.tags ?? current.tags ?? [],
  sourceSchema:
    updates.sourceSchema ??
    current.sourceSchema ??
    null,
  targetSchema:
    updates.targetSchema ??
    current.targetSchema ??
    null,
  mappingRules: updates.mappingRules ?? current.mappingRules ?? [],
  validationRules: updates.validationRules ?? current.validationRules ?? [],
  duplicateResolution: updates.duplicateResolution ?? current.duplicateResolution ?? { strategy: 'ignore' },
  dataTransformations: updates.dataTransformations ?? current.dataTransformations ?? [],
});

registry.registerConfigProvider<ResolverDraft>({
  nodeType: 'resolver',
  getCreateStepConfigs(): PluginStepConfig<ResolverDraft>[] {
    return [
      {
        id: 'basic-info',
        label: 'Basic Information',
        componentFactory: (p: ResolverStepProps) => {
          const draft = ensureDraft(p.data);
          return (
            <SharedBasicInfoStep
              name={draft.name ?? ''}
              description={draft.description ?? ''}
              tags={draft.tags ?? []}
              mode={p.mode}
              onChange={(value: BasicInfoData) =>
                p.onChange(
                  mergeDraft(draft, {
                    name: value.name,
                    description: value.description,
                    tags: value.tags,
                  })
                )
              }
              validate={({ name }) => (name.trim().length ? null : 'Name is required')}
            />
          );
        },
        validate: (data?: ResolverDraft) => Boolean(data?.name?.trim()),
      },
      {
        id: 'schema', label: 'Schema Selection', validate: () => true,
        componentFactory: (p: ResolverStepProps) => {
          const currentData = ensureDraft(p.data);
          return (
            <SchemaSelectionStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverDraftEntity>) =>
                p.onChange(mergeDraft(currentData, updates))
              }
              onValidationChange={p.setValid}
              onSourceSchemaChange={(schema: SchemaInfo | null) =>
                p.onChange(mergeDraft(currentData, { sourceSchema: schema }))
              }
              onTargetSchemaChange={(schema: SchemaInfo | null) =>
                p.onChange(mergeDraft(currentData, { targetSchema: schema }))
              }
            />
          );
        },
      },
      {
        id: 'mapping', label: 'Property Mapping', validate: () => true,
        componentFactory: (p: ResolverStepProps) => {
          const currentData = ensureDraft(p.data);
          return (
            <PropertyMappingStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverDraftEntity>) =>
                p.onChange(mergeDraft(currentData, updates))
              }
              onValidationChange={p.setValid}
              sourceSchema={currentData.sourceSchema ?? null}
              targetSchema={currentData.targetSchema ?? null}
            />
          );
        },
      },
      {
        id: 'validation', label: 'Validation Rules', validate: () => true,
        componentFactory: (p: ResolverStepProps) => {
          const currentData = ensureDraft(p.data);
          return (
            <ValidationConfigStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverDraftEntity>) =>
                p.onChange(mergeDraft(currentData, updates))
              }
              onValidationChange={p.setValid}
              sourceSchema={currentData.sourceSchema ?? null}
              targetSchema={currentData.targetSchema ?? null}
            />
          );
        },
      },
      {
        id: 'dedupe', label: 'Duplicate Resolution', validate: () => true,
        componentFactory: (p: ResolverStepProps) => {
          const currentData = ensureDraft(p.data);
          return (
            <DuplicateResolutionStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverDraftEntity>) =>
                p.onChange(mergeDraft(currentData, updates))
              }
              onValidationChange={p.setValid}
            />
          );
        },
      },
      {
        id: 'preview', label: 'Preview/Test', validate: () => true,
        componentFactory: (p: ResolverStepProps) => {
          const currentData = ensureDraft(p.data);
          return (
            <PreviewTestStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverDraftEntity>) =>
                p.onChange(mergeDraft(currentData, updates))
              }
              onValidationChange={p.setValid}
              sourceSchema={currentData.sourceSchema ?? null}
              targetSchema={currentData.targetSchema ?? null}
              onValidationResult={(result: MappingValidationResult | null) =>
                p.onChange({ ...currentData, lastValidation: result })
              }
            />
          );
        },
      },
      {
        id: 'build',
        label: 'Build',
        optional: true,
        componentFactory: (p: ResolverStepProps) => {
          const currentData = ensureDraft(p.data);
          return <ResolverBuildStep draft={currentData} />;
        },
        capabilities: {
          canStartBatch: (data: ResolverDraft) =>
            Boolean(data?.name?.trim() && data?.sourceSchema && data?.targetSchema),
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) { return this.getCreateStepConfigs(); },
});
