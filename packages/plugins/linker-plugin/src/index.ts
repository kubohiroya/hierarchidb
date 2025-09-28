import { registerRuntimeWorkerNotImplemented } from '@hierarchidb/plugins-runtime-worker-factory';

// Minimal entry with UI steps registration for Linker
export const version = '0.0.0-dev';
export default {} as const;

// Register UI steps (Step2~4) using existing TreeConsolePanel/Map components
import './ui/steps-provider';

// Runtime wiring stub to surface unimplemented runtime worker integration
export class RuntimeWiring {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    registerRuntimeWorkerNotImplemented('linker', '[linker-plugin] runtime worker integration is not implemented yet');
  }
}
