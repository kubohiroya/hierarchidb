import { PluginStepRegistry, type StepComponentProps, type PluginStepConfig, type StepData } from '@hierarchidb/plugin-base';
import { SchemaSelectionStep } from './steps/SchemaSelectionStep.js';
import { PropertyMappingStep } from './steps/PropertyMappingStep.js';
import { ValidationConfigStep } from './steps/ValidationConfigStep.js';
import { DuplicateResolutionStep } from './steps/DuplicateResolutionStep.js';
import { PreviewTestStep } from './steps/PreviewTestStep.js';
import type { ResolverUpdaterPayload, SchemaInfo, MappingValidationResult } from '../../common/types/index.js';
import type { NodeId } from '@hierarchidb/common-types';
import { ResolverBuildStep } from './steps/ResolverBuildStep.js';

const registry = PluginStepRegistry.getInstance();

type ResolverData = StepData & ResolverUpdaterPayload & {
  lastValidation?: MappingValidationResult | null;
};

type ResolverStepProps = StepComponentProps<ResolverUpdaterPayload>;

const ensureDraft = (data?: ResolverData): ResolverData => {
  const draft = data ?? ({} as ResolverData);
  return {
    treeNodeId: (draft.treeNodeId ?? '') as NodeId,
    draftMetadata: draft.draftMetadata ?? { name: '', description: '', tags: [] },
    draftData: {
      sourceSchema: draft.draftData?.sourceSchema ?? null,
      targetSchema: draft.draftData?.targetSchema ?? null,
      mappingRules: draft.draftData?.mappingRules ?? [],
      validationRules: draft.draftData?.validationRules ?? [],
      duplicateResolution: draft.draftData?.duplicateResolution ?? { strategy: 'ignore' },
      dataTransformations: draft.draftData?.dataTransformations ?? [],
      previewConfig: draft.draftData?.previewConfig,
    },
    lastValidation: draft.lastValidation ?? null,
  } as ResolverData;
};

const mergeDraft = (
  current: ResolverData,
  updates: Partial<ResolverUpdaterPayload>
): ResolverData => {
  const nextDraftMetadata = {
    ...(current.draftMetadata ?? { name: '', description: '', tags: [] }),
    ...(updates.draftMetadata ?? {}),
  };
  const nextDraftData = {
    ...(current.draftData ?? {}),
    ...(updates.draftData ?? {}),
  };
  return {
    ...current,
    treeNodeId: updates.treeNodeId ?? current.treeNodeId,
    draftMetadata: nextDraftMetadata,
    draftData: nextDraftData,
    lastValidation: updates.lastValidation ?? current.lastValidation ?? null,
  } as ResolverData;
};

registry.registerConfigProvider<ResolverUpdaterPayload>({
  nodeType: 'resolver',
  getCreateStepConfigs(): PluginStepConfig<ResolverUpdaterPayload>[] {
    return [
      {
        id: 'schema', label: 'Schema Selection', validate: () => true,
        componentFactory: (p: ResolverStepProps) => {
          const currentData = ensureDraft(p.data);
          return (
            <SchemaSelectionStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverUpdaterPayload>) =>
                p.onChange(mergeDraft(currentData, updates))
              }
              onValidationChange={p.setValid}
              onSourceSchemaChange={(schema: SchemaInfo | null) =>
                p.onChange(mergeDraft(currentData, { draftData: { sourceSchema: schema } }))
              }
              onTargetSchemaChange={(schema: SchemaInfo | null) =>
                p.onChange(mergeDraft(currentData, { draftData: { targetSchema: schema } }))
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
              onUpdate={(updates: Partial<ResolverUpdaterPayload>) =>
                p.onChange(mergeDraft(currentData, updates))
              }
              onValidationChange={p.setValid}
              sourceSchema={currentData.draftData?.sourceSchema ?? null}
              targetSchema={currentData.draftData?.targetSchema ?? null}
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
              onUpdate={(updates: Partial<ResolverUpdaterPayload>) =>
                p.onChange(mergeDraft(currentData, updates))
              }
              onValidationChange={p.setValid}
              sourceSchema={currentData.draftData?.sourceSchema ?? null}
              targetSchema={currentData.draftData?.targetSchema ?? null}
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
              onUpdate={(updates: Partial<ResolverUpdaterPayload>) =>
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
              onUpdate={(updates: Partial<ResolverUpdaterPayload>) =>
                p.onChange(mergeDraft(currentData, updates))
              }
              onValidationChange={p.setValid}
              sourceSchema={currentData.draftData?.sourceSchema ?? null}
              targetSchema={currentData.draftData?.targetSchema ?? null}
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
          canStartBatch: (data: ResolverUpdaterPayload) =>
            Boolean(data?.draftMetadata?.name?.trim() && data?.draftData?.sourceSchema && data?.draftData?.targetSchema),
        },
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) { return this.getCreateStepConfigs(); },
});
