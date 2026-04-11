import { type PluginStepProps, PluginStepRegistry, type PluginStepConfig } from '@hierarchidb/plugin-base';
import { YAML_NODE_TYPE } from '../../common/constants.js';
import { YamlBasicInfoStep } from './steps/YamlBasicInfoStep.js';
import { YamlSchemaSelectionStep } from './steps/YamlSchemaSelectionStep.js';
import { YamlSchemaEditorStep } from './steps/YamlSchemaEditorStep.js';
import type { YamlDraft } from '../../common/types/yamlEntityTypes.js';

const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider({
    nodeType: YAML_NODE_TYPE,
    getCreateStepConfigs(): ReadonlyArray<PluginStepConfig<YamlDraft>> {
        return [
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
                componentFactory: (props: PluginStepProps<YamlDraft>) => <YamlSchemaSelectionStep {...props} />,
                validate: (data?: YamlDraft) => Boolean(data?.schemaId),
                capabilities: {
                    canProceedToNext: (data?: YamlDraft) => Boolean(data?.schemaId),
                },
            },
            {
                id: 'schema-editor',
                label: 'Schema Editor',
                componentFactory: (props: PluginStepProps<YamlDraft>) => <YamlSchemaEditorStep {...props} />,
                validate: () => true,
                capabilities: {
                    canSave: () => true,
                },
            },
        ];
    },
    getEditStepConfigs(): ReadonlyArray<PluginStepConfig<YamlDraft>> {
        return this.getCreateStepConfigs();
    },
});
