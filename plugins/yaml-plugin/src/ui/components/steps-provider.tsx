import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import { createYamlStepConfigProvider } from './createYamlStepConfigProvider.js';
import type {
  YamlIdeGsmStep4Global,
  YamlIdeGsmStep4Runtime,
} from './steps/YamlIdeGsmCommandStepTypes.js';

const registry = PluginStepRegistry.getInstance();

function readInjectedStep4Runtime(): YamlIdeGsmStep4Runtime {
  return (
    (globalThis as YamlIdeGsmStep4Global).__HDB_YAML_IDE_GSM_STEP4__ ??
    Object.freeze({ enabled: false })
  );
}

registry.registerConfigProvider(createYamlStepConfigProvider(readInjectedStep4Runtime()));
