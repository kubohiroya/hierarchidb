import type { NodeId } from '@hierarchidb/core-types';
import {
  type PluginStepConfig,
  type PluginStepProps,
  PluginStepRegistry,
  type StepData,
} from '@hierarchidb/plugin-base';
import { i18n } from '@hierarchidb/ui-i18n';
import type { MappingValidationResult, ResolverUpdaterPayload, SchemaInfo } from '~/common/entities/ResolverEntity';
import { DuplicateResolutionStep } from './steps/DuplicateResolutionStep.js';
import { PreviewTestStep } from './steps/PreviewTestStep.js';
import { PropertyMappingStep } from './steps/PropertyMappingStep.js';
import { ResolverBuildStep } from './steps/ResolverBuildStep.js';
import { SchemaSelectionStep } from './steps/SchemaSelectionStep.js';
import { ValidationConfigStep } from './steps/ValidationConfigStep.js';

const registry = PluginStepRegistry.getInstance();

type ResolverData = StepData &
  ResolverUpdaterPayload & {
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

const serializeComparable = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const createDraftUpdater = (initial: ResolverData, onChange: ResolverStepProps['onChange']) => {
  let latestDraft = { ...(initial ?? {}) };
  let latestSignature = serializeComparable(latestDraft);

  return (updates: Partial<ResolverUpdaterPayload> | Pick<ResolverData, 'lastValidation'>) => {
    const nextDraft = mergeDraft(latestDraft, updates);
    const nextSignature = serializeComparable(nextDraft);
    if (nextSignature === latestSignature) {
      return;
    }
    latestDraft = nextDraft;
    latestSignature = nextSignature;
    onChange(nextDraft);
  };
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
          const handleUpdate = createDraftUpdater(currentData, p.onChange);
          return (
            <SchemaSelectionStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverUpdaterPayload>) => handleUpdate(updates)}
              onValidationChange={p.setValid}
              onSourceSchemaChange={(schema: SchemaInfo | null) =>
                handleUpdate({ draftData: { sourceSchema: schema } })
              }
              onTargetSchemaChange={(schema: SchemaInfo | null) =>
                handleUpdate({ draftData: { targetSchema: schema } })
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
          const handleUpdate = createDraftUpdater(currentData, p.onChange);
          return (
            <PropertyMappingStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverUpdaterPayload>) => handleUpdate(updates)}
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
          const handleUpdate = createDraftUpdater(currentData, p.onChange);
          return (
            <ValidationConfigStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverUpdaterPayload>) => handleUpdate(updates)}
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
          const handleUpdate = createDraftUpdater(currentData, p.onChange);
          return (
            <DuplicateResolutionStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverUpdaterPayload>) => handleUpdate(updates)}
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
            Boolean(
              data?.draftMetadata?.name?.trim() &&
                data?.draftData?.sourceSchema &&
                data?.draftData?.targetSchema
            ),
        },
        validate: (data?: ResolverUpdaterPayload) => isResolverBuildPersisted(data),
      },
      {
        id: 'preview',
        label: t('steps.previewTest.label', 'Preview / Test'),
        validate: (data?: ResolverUpdaterPayload) => isResolverBuildPersisted(data),
        componentFactory: (p: ResolverStepProps) => {
          const currentData = ensureDraft(p.data);
          const handleUpdate = createDraftUpdater(currentData, p.onChange);
          return (
            <PreviewTestStep
              data={currentData}
              onUpdate={(updates: Partial<ResolverUpdaterPayload>) => handleUpdate(updates)}
              onValidationChange={p.setValid}
              sourceSchema={currentData.draftData?.sourceSchema ?? null}
              targetSchema={currentData.draftData?.targetSchema ?? null}
              onValidationResult={(result: MappingValidationResult | null) =>
                handleUpdate({ lastValidation: result })
              }
            />
          );
        },
      },
    ];
  },
  getEditStepConfigs(_nodeId: string) {
    return this.getCreateStepConfigs();
  },
});
