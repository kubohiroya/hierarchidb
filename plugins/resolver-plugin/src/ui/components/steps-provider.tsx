import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/plugin-base';
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
  ResolverWorkingCopyEntity,
  SchemaInfo,
  MappingValidationResult,
  ResolverWorkingCopy,
} from '../../common/types/index.js';
import { ResolverBuildStep } from './steps/ResolverBuildStep.js';

const registry = PluginStepRegistry.getInstance();

type ResolverData = Partial<ResolverWorkingCopyEntity> & {
  sourceSchema?: SchemaInfo | null;
  targetSchema?: SchemaInfo | null;
  lastValidation?: MappingValidationResult | null;
};

type ResolverStepProps = StepComponentProps<ResolverWorkingCopy>;

const ensureWorkingCopy = (data?: ResolverData): ResolverWorkingCopy => {
  const draft = (data ?? {}) as ResolverWorkingCopy;
  return {
    ...draft,
    tags: draft.tags ?? [],
  } as ResolverWorkingCopy;
};

const mergeWorkingCopy = (
  current: ResolverWorkingCopy,
  updates: Partial<ResolverWorkingCopyEntity>
): ResolverWorkingCopy => ({
  ...current,
  ...updates,
  tags: updates.tags ?? current.tags ?? [],
});

registry.registerConfigProvider({
  nodeType: 'resolver',
  getCreateStepConfigs() {
    return [
      {
        id: 'basic-info',
        label: 'Basic Information',
        componentFactory: (p: ResolverStepProps) => {
          const workingCopy = ensureWorkingCopy(p.data);
          return (
            <SharedBasicInfoStep
              name={workingCopy.name ?? ''}
              description={workingCopy.description ?? ''}
              tags={workingCopy.tags ?? []}
              mode={p.mode}
              onChange={(value: BasicInfoData) =>
                p.onChange(
                  mergeWorkingCopy(workingCopy, {
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
        validate: (data?: ResolverWorkingCopy) => Boolean(data?.name?.trim()),
      },
      {
        id: 'schema', label: 'Schema Selection', validate: () => true,
        componentFactory: (p: ResolverStepProps) => {
          const currentData = ensureWorkingCopy(p.data);
          return (
            <SchemaSelectionStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverWorkingCopyEntity>) =>
                p.onChange(mergeWorkingCopy(currentData, updates))
              }
              onValidationChange={p.setValid}
              onSourceSchemaChange={(schema: SchemaInfo | null) => p.onChange({ ...currentData, sourceSchema: schema })}
              onTargetSchemaChange={(schema: SchemaInfo | null) => p.onChange({ ...currentData, targetSchema: schema })}
            />
          );
        },
      },
      {
        id: 'mapping', label: 'Property Mapping', validate: () => true,
        componentFactory: (p: ResolverStepProps) => {
          const currentData = ensureWorkingCopy(p.data);
          return (
            <PropertyMappingStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverWorkingCopyEntity>) =>
                p.onChange(mergeWorkingCopy(currentData, updates))
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
          const currentData = ensureWorkingCopy(p.data);
          return (
            <ValidationConfigStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverWorkingCopyEntity>) =>
                p.onChange(mergeWorkingCopy(currentData, updates))
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
          const currentData = ensureWorkingCopy(p.data);
          return (
            <DuplicateResolutionStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverWorkingCopyEntity>) =>
                p.onChange(mergeWorkingCopy(currentData, updates))
              }
              onValidationChange={p.setValid}
            />
          );
        },
      },
      {
        id: 'preview', label: 'Preview/Test', validate: () => true,
        componentFactory: (p: ResolverStepProps) => {
          const currentData = ensureWorkingCopy(p.data);
          return (
            <PreviewTestStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverWorkingCopyEntity>) =>
                p.onChange(mergeWorkingCopy(currentData, updates))
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
          const currentData = ensureWorkingCopy(p.data);
          return <ResolverBuildStep workingCopy={currentData} />;
        },
        capabilities: {
          canStartBatch: (data: ResolverWorkingCopy) =>
            Boolean(data?.name?.trim() && data?.sourceSchema && data?.targetSchema),
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) { return this.getCreateStepConfigs(); },
});
