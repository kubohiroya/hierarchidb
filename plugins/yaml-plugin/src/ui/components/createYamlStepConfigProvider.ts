import type { PluginStepConfig, PluginStepProps } from '@hierarchidb/plugin-base';
import { createElement } from 'react';
import { YAML_NODE_TYPE } from '../../common/constants.js';
import type { YamlDraft } from '../../common/types/yamlEntityTypes.js';
import { YamlBasicInfoStep } from './steps/YamlBasicInfoStep.js';
import { YamlIdeGsmCommandStep } from './steps/YamlIdeGsmCommandStep.js';
import type { YamlIdeGsmStep4Runtime } from './steps/YamlIdeGsmCommandStepTypes.js';
import { YamlSchemaEditorStep } from './steps/YamlSchemaEditorStep.js';
import { YamlSchemaSelectionStep } from './steps/YamlSchemaSelectionStep.js';

export function createYamlStepConfigProvider(step4Runtime: YamlIdeGsmStep4Runtime) {
  return {
    nodeType: YAML_NODE_TYPE,
    getCreateStepConfigs(): ReadonlyArray<PluginStepConfig<YamlDraft>> {
      const steps: PluginStepConfig<YamlDraft>[] = [
        {
          id: 'basic-info',
          label: 'Basic Info',
          componentFactory: (props: PluginStepProps<YamlDraft>) =>
            createElement(YamlBasicInfoStep, props),
          validate: (data?: YamlDraft) => Boolean(data?.name?.trim()),
          capabilities: {
            canProceedToNext: (data?: YamlDraft) => Boolean(data?.name?.trim()),
          },
        },
        {
          id: 'schema-selection',
          label: 'Schema Selection',
          componentFactory: (props: PluginStepProps<YamlDraft>) =>
            createElement(YamlSchemaSelectionStep, props),
          validate: (data?: YamlDraft) => Boolean(data?.schemaId),
          capabilities: {
            canProceedToNext: (data?: YamlDraft) => Boolean(data?.schemaId),
          },
        },
        {
          id: 'schema-editor',
          label: 'Schema Editor',
          componentFactory: (props: PluginStepProps<YamlDraft>) =>
            createElement(YamlSchemaEditorStep, props),
          validate: () => true,
          capabilities: {
            canSave: () => true,
          },
        },
      ];
      if (step4Runtime.enabled) {
        steps.push({
          id: 'ide-gsm-command',
          label: 'IDE-GSM Command',
          componentFactory: (props: PluginStepProps<YamlDraft>) =>
            createElement(YamlIdeGsmCommandStep, { ...props, step4Runtime }),
          validate: () => true,
          capabilities: {
            canSave: () => true,
          },
          optional: true,
        });
      }
      return steps;
    },
    getEditStepConfigs(): ReadonlyArray<PluginStepConfig<YamlDraft>> {
      return this.getCreateStepConfigs();
    },
  };
}
