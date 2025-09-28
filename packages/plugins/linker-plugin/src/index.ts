// Minimal entry with UI steps registration for Linker
export const version = '0.0.0-dev';
export default {} as const;

// Register UI steps (Step2~4) using existing TreeConsolePanel/Map components
import './ui/steps-provider';

// Runtime wiring stub to surface unimplemented runtime worker integration
export class RuntimeWiring {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    // Linker plugin currently relies on UI-side worker bootstrap helpers only.
  }
}
