import {
  type PluginStepConfig,
  type PluginStepProps,
  PluginStepRegistry,
} from '@hierarchidb/plugin-base';
import { YAML_NODE_TYPE } from '../../common/constants.js';
import type { YamlDraft } from '../../common/types/yamlEntityTypes.js';
import { YamlBasicInfoStep } from './steps/YamlBasicInfoStep.js';
import { YamlIdeGsmCommandStep } from './steps/YamlIdeGsmCommandStep.js';
import type {
  YamlIdeGsmStep4Global,
  YamlIdeGsmStep4Runtime,
} from './steps/YamlIdeGsmCommandStepTypes.js';
import { YamlSchemaEditorStep } from './steps/YamlSchemaEditorStep.js';
import { YamlSchemaSelectionStep } from './steps/YamlSchemaSelectionStep.js';

const registry = PluginStepRegistry.getInstance();

function readInjectedStep4Runtime(): YamlIdeGsmStep4Runtime {
  return (
    (globalThis as YamlIdeGsmStep4Global).__HDB_YAML_IDE_GSM_STEP4__ ??
    Object.freeze({ enabled: false })
  );
}

export function createYamlStepConfigProvider(step4Runtime: YamlIdeGsmStep4Runtime) {
  return {
    nodeType: YAML_NODE_TYPE,
    getCreateStepConfigs(): ReadonlyArray<PluginStepConfig<YamlDraft>> {
      const steps: PluginStepConfig<YamlDraft>[] = [
        {
          id: 'basic-info',
          label: 'Basic Info',
          componentFactory: (props: PluginStepProps<YamlDraft>) => <YamlBasicInfoStep {...props} />,
          validate: (data?: YamlDraft) => Boolean(data?.name?.trim()),
          capabilities: {
            canProceedToNext: (data?: YamlDraft) => Boolean(data?.name?.trim()),
          },
        },
        {
          id: 'schema-selection',
          label: 'Schema Selection',
          componentFactory: (props: PluginStepProps<YamlDraft>) => (
            <YamlSchemaSelectionStep {...props} />
          ),
          validate: (data?: YamlDraft) => Boolean(data?.schemaId),
          capabilities: {
            canProceedToNext: (data?: YamlDraft) => Boolean(data?.schemaId),
          },
        },
        {
          id: 'schema-editor',
          label: 'Schema Editor',
          componentFactory: (props: PluginStepProps<YamlDraft>) => (
            <YamlSchemaEditorStep {...props} />
          ),
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
          componentFactory: (props: PluginStepProps<YamlDraft>) => (
            <YamlIdeGsmCommandStep {...props} step4Runtime={step4Runtime} />
          ),
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

registry.registerConfigProvider(createYamlStepConfigProvider(readInjectedStep4Runtime()));
