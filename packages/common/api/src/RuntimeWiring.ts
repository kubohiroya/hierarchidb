// Shared plugin runtime wiring interfaces

export interface PluginRuntimeWiring {
  // Optional hooks that a plugin may expose for runtime bootstrap to call
  registerSharedDownloadService?: () => Promise<void> | void;
  registerAuthNotifier?: () => Promise<void> | void;
  registerRuntimeWorkerAdapters?: () => Promise<void> | void;
}

