import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/plugin-base';
import { SchemaSelectionStep } from './steps/SchemaSelectionStep.js';
import { PropertyMappingStep } from './steps/PropertyMappingStep.js';
import { ValidationConfigStep } from './steps/ValidationConfigStep.js';
import { DuplicateResolutionStep } from './steps/DuplicateResolutionStep.js';
import { PreviewTestStep } from './steps/PreviewTestStep.js';
import type { ResolverWorkingCopyEntity, SchemaInfo, MappingValidationResult } from '../../common/types/index.js';

const registry = PluginStepRegistry.getInstance();

type ResolverData = Partial<ResolverWorkingCopyEntity> & {
  sourceSchema?: SchemaInfo | null;
  targetSchema?: SchemaInfo | null;
  lastValidation?: MappingValidationResult | null;
};

type ResolverStepProps = StepComponentProps & { data: ResolverData };

registry.registerConfigProvider({
  nodeType: 'resolver',
  getCreateStepConfigs() {
    return [
      {
        id: 'schema', label: 'Schema Selection', validate: () => true,
        componentFactory: (p: ResolverStepProps) => {
          const currentData: ResolverData = p.data ?? {};
          return (
            <SchemaSelectionStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverWorkingCopyEntity>) => p.onChange({ ...currentData, ...updates })}
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
          const currentData: ResolverData = p.data ?? {};
          return (
            <PropertyMappingStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverWorkingCopyEntity>) => p.onChange({ ...currentData, ...updates })}
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
          const currentData: ResolverData = p.data ?? {};
          return (
            <ValidationConfigStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverWorkingCopyEntity>) => p.onChange({ ...currentData, ...updates })}
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
          const currentData: ResolverData = p.data ?? {};
          return (
            <DuplicateResolutionStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverWorkingCopyEntity>) => p.onChange({ ...currentData, ...updates })}
              onValidationChange={p.setValid}
            />
          );
        },
      },
      {
        id: 'preview', label: 'Preview/Test', validate: () => true,
        componentFactory: (p: ResolverStepProps) => {
          const currentData: ResolverData = p.data ?? {};
          return (
            <PreviewTestStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverWorkingCopyEntity>) => p.onChange({ ...currentData, ...updates })}
              onValidationChange={p.setValid}
              sourceSchema={currentData.sourceSchema ?? null}
              targetSchema={currentData.targetSchema ?? null}
              onValidationResult={(result: MappingValidationResult | null) => p.onChange({ ...currentData, lastValidation: result })}
            />
          );
        },
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) { return this.getCreateStepConfigs(); },
});
