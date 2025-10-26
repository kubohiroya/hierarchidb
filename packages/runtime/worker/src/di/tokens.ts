export const WorkerDiTokens = {
  PluginWorkerSpecifierMap: Symbol.for('runtime-worker.PluginWorkerSpecifierMap'),
  PluginWorkerSourceMap: Symbol.for('runtime-worker.PluginWorkerSourceMap'),
  PluginWorkerModuleLoader: Symbol.for('runtime-worker.PluginWorkerModuleLoader'),
  PluginRegistry: Symbol.for('runtime-worker.PluginRegistry'),
} as const;

export type WorkerDiTokenKeys = keyof typeof WorkerDiTokens;
