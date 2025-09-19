import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import { SchemaSelectionStep } from '../components/steps/SchemaSelectionStep.js';
import { PropertyMappingStep } from '../components/steps/PropertyMappingStep.js';
import { ValidationConfigStep } from '../components/steps/ValidationConfigStep.js';
import { DuplicateResolutionStep } from '../components/steps/DuplicateResolutionStep.js';
import { PreviewTestStep } from '../components/steps/PreviewTestStep.js';
import type { ResolverWorkingCopyEntity, SchemaInfo, MappingValidationResult } from '../types/index.js';

const registry = PluginStepRegistry.getInstance();

type ResolverData = Partial<ResolverWorkingCopyEntity> & {
  sourceSchema?: SchemaInfo | null;
  targetSchema?: SchemaInfo | null;
  lastValidation?: MappingValidationResult | null;
};

type P = StepComponentProps & { data: ResolverData };

registry.registerConfigProvider({
  nodeType: 'resolver',
  getCreateStepConfigs() {
    return [
      {
        id: 'schema', label: 'Schema Selection', validate: () => true,
        componentFactory: (p: P) => (
          <SchemaSelectionStep
            data={p.data}
            onUpdate={(u) => p.onChange({ ...(p.data || {}), ...u })}
            onValidationChange={p.setValid}
            onSourceSchemaChange={(s) => p.onChange({ ...(p.data || {}), sourceSchema: s })}
            onTargetSchemaChange={(s) => p.onChange({ ...(p.data || {}), targetSchema: s })}
          />
        ),
      },
      {
        id: 'mapping', label: 'Property Mapping', validate: () => true,
        componentFactory: (p: P) => (
          <PropertyMappingStep
            data={p.data}
            onUpdate={(u) => p.onChange({ ...(p.data || {}), ...u })}
            onValidationChange={p.setValid}
            sourceSchema={p.data?.sourceSchema ?? null}
            targetSchema={p.data?.targetSchema ?? null}
          />
        ),
      },
      {
        id: 'validation', label: 'Validation Rules', validate: () => true,
        componentFactory: (p: P) => (
          <ValidationConfigStep
            data={p.data}
            onUpdate={(u) => p.onChange({ ...(p.data || {}), ...u })}
            onValidationChange={p.setValid}
            sourceSchema={p.data?.sourceSchema ?? null}
            targetSchema={p.data?.targetSchema ?? null}
          />
        ),
      },
      {
        id: 'dedupe', label: 'Duplicate Resolution', validate: () => true,
        componentFactory: (p: P) => (
          <DuplicateResolutionStep
            data={p.data}
            onUpdate={(u) => p.onChange({ ...(p.data || {}), ...u })}
            onValidationChange={p.setValid}
          />
        ),
      },
      {
        id: 'preview', label: 'Preview/Test', validate: () => true,
        componentFactory: (p: P) => (
          <PreviewTestStep
            data={p.data}
            onUpdate={(u) => p.onChange({ ...(p.data || {}), ...u })}
            onValidationChange={p.setValid}
            sourceSchema={p.data?.sourceSchema ?? null}
            targetSchema={p.data?.targetSchema ?? null}
            onValidationResult={(r) => p.onChange({ ...(p.data || {}), lastValidation: r })}
          />
        ),
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) { return this.getCreateStepConfigs(); },
});
