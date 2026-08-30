import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import { createFdmStepConfigProvider } from './createFdmStepConfigProvider.js';
import type { FdmPluginRuntime, FdmPluginRuntimeGlobal } from './fdmStepProviderTypes.js';

const registry = PluginStepRegistry.getInstance();

function readInjectedRuntime(): FdmPluginRuntime {
  return (globalThis as FdmPluginRuntimeGlobal).__HDB_FDM__ ?? Object.freeze({ enabled: false });
}

registry.registerConfigProvider(createFdmStepConfigProvider(readInjectedRuntime()));
