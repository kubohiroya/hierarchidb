import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import { createIdeGsmProjectStepConfigProvider } from './createIdeGsmProjectStepConfigProvider.js';
import type { IdeGsmProjectRuntime, IdeGsmProjectRuntimeGlobal } from './steps-provider-types.js';

const registry = PluginStepRegistry.getInstance();

function readInjectedRuntime(): IdeGsmProjectRuntime {
  return (
    (globalThis as IdeGsmProjectRuntimeGlobal).__HDB_IDEGSM_PROJECT__ ??
    Object.freeze({ enabled: false })
  );
}

registry.registerConfigProvider(createIdeGsmProjectStepConfigProvider(readInjectedRuntime()));
