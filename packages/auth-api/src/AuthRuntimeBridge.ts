// Auth-related runtime hooks exposed by plugins for worker bootstrap.
export interface AuthRuntimeBridge {
  registerAuthNotifier?: () => Promise<void> | void;
  registerRuntimeWorkerAdapters?: () => Promise<void> | void;
}
