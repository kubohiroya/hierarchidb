import { PluginStepRegistry, type PluginStepProps, type PluginStepConfig, type StepData } from '@hierarchidb/plugin-base';
import { SchemaSelectionStep } from './steps/SchemaSelectionStep.js';
import { PropertyMappingStep } from './steps/PropertyMappingStep.js';
import { ValidationConfigStep } from './steps/ValidationConfigStep.js';
import { DuplicateResolutionStep } from './steps/DuplicateResolutionStep.js';
import { PreviewTestStep } from './steps/PreviewTestStep.js';
import type { ResolverUpdaterPayload, SchemaInfo, MappingValidationResult } from '../../common/types/index.js';
import type { NodeId } from '@hierarchidb/core-types';
import { ResolverBuildStep } from './steps/ResolverBuildStep.js';
import { i18n } from '../i18n.js';

const registry = PluginStepRegistry.getInstance();

type ResolverData = StepData & ResolverUpdaterPayload & {
  lastValidation?: MappingValidationResult | null;
};

type ResolverStepProps = PluginStepProps<ResolverUpdaterPayload>;

const t = (key: string, fallback: string) =>
  String(i18n.t(key, { ns: 'resolver-plugin', defaultValue: fallback }));

const isResolverBuildPersisted = (data?: ResolverUpdaterPayload): boolean =>
  Boolean(data?.draftData?.isCompiled || data?.draftData?.compiledFunction);

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
        id: 'schema',
        label: t('steps.schemaSelection.label', 'Schema Selection'),
        validate: () => true,
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
        id: 'mapping',
        label: t('steps.propertyMapping.label', 'Property Mapping'),
        validate: () => true,
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
        id: 'validation',
        label: t('steps.validationRules.label', 'Validation Rules'),
        validate: () => true,
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
        id: 'dedupe',
        label: t('steps.duplicateResolution.label', 'Duplicate Resolution'),
        validate: () => true,
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
        id: 'stage',
        label: t('steps.stage.label', 'Build'),
        optional: true,
        componentFactory: (p: ResolverStepProps) => {
          const currentData = ensureDraft(p.data);
          return <ResolverBuildStep draft={currentData} />;
        },
        capabilities: {
          canStartBuild: (data: ResolverUpdaterPayload) =>
            Boolean(data?.draftMetadata?.name?.trim() && data?.draftData?.sourceSchema && data?.draftData?.targetSchema),
        },
        validate: (data?: ResolverUpdaterPayload) => isResolverBuildPersisted(data),
      },
      {
        id: 'preview',
        label: t('steps.previewTest.label', 'Preview / Test'),
        validate: (data?: ResolverUpdaterPayload) => isResolverBuildPersisted(data),
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
    ];
  },
  getEditStepConfigs(_nodeId: string) { return this.getCreateStepConfigs(); },
});
