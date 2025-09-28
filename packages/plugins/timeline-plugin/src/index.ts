import { registerRuntimeWorkerNotImplemented } from '@hierarchidb/plugins-runtime-worker-factory';

// Minimal stub entry for @hierarchidb/plugins-timeline-plugin
export const version = '0.0.1';
export default {};

export class RuntimeWiring {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    registerRuntimeWorkerNotImplemented('timeline', '[timeline-plugin] runtime worker integration is not implemented yet');
  }
}
