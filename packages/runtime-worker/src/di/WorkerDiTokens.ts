export const WorkerDiTokens = {
  PluginWorkerSpecifierMap: Symbol.for('runtime-worker-worker.PluginWorkerSpecifierMap'),
  PluginWorkerSourceMap: Symbol.for('runtime-worker-worker.PluginWorkerSourceMap'),
  PluginWorkerLoaderMap: Symbol.for('runtime-worker-worker.PluginWorkerLoaderMap'),
  PluginWorkerModuleLoader: Symbol.for('runtime-worker-worker.PluginWorkerModuleLoader'),
  PluginRegistry: Symbol.for('runtime-worker-worker.PluginRegistry'),
} as const;

export type WorkerDiTokenKeys = keyof typeof WorkerDiTokens;
