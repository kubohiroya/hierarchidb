// Minimal stub entry for @hierarchidb/plugins-timeline-plugin
export const version = '0.0.1';
export default {};

export class RuntimeWiring {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    // Timeline plugin does not need custom runtime worker adapters at present.
  }
}
