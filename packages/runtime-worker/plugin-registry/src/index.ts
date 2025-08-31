/**
 * @hierarchidb/runtime-worker-worker-plugin-registry
 * 
 * プラグインレジストリパッケージのエントリーポイント
 * Worker側で動作するプラグインシステムを提供
 */

// === 1. Discovery (探索) ===
export type {
  IPluginDiscoveryStrategy,
  PluginManifest,
  DiscoveryOptions,
} from './1-discovery/PluginDiscoveryStrategy';
export {
  BasePluginDiscoveryStrategy,
} from './1-discovery/PluginDiscoveryStrategy';

// === 2. Definition (定義) ===
export type {
  IPluginDefinitionFactory,
} from './2-definition/PluginDefinitionFactory';
export {
  PluginDefinitionFactory,
  PluginDefinitionBuilder,
  PluginDefinitionValidator,
} from './2-definition/PluginDefinitionFactory';

// === 3. Resolution (依存関係解決) ===
export type {
  DependencyResolutionResult,
  DependencyGraph,
  DependencyError,
} from './3-resolution/DependencyResolver';
export {
  DependencyResolver,
  TopologicalSorter,
  CircularDependencyDetector,
} from './3-resolution/DependencyResolver';

// === 4. Initialization (初期化) ===
export type {
  InitializationContext,
  InitializationResult,
} from './4-initialization/PluginInitializer';
export {
  PluginInitializer,
  StandardPluginInitializer,
  IconResolver,
  ComponentLoader,
} from './4-initialization/PluginInitializer';

// === 5. Repository (リポジトリ) ===
export type {
  IPluginRepository,
  PluginStore,
  PluginQuery,
  RepositoryStatistics,
} from './5-repository/PluginRepository';
export {
  PluginRepository,
} from './5-repository/PluginRepository';

// === 6. Facade (ファサード) ===
export type {
  IPluginRegistryAPI,
  PluginProviderAPI,
  PluginStatistics,
  CreateMenuItem,
} from './6-facade/PluginRegistryFacade';
export {
  PluginRegistryFacade,
} from './6-facade/PluginRegistryFacade';

export type {
  PluginEvent,
  PluginEventPayload,
} from './6-facade/PluginEventEmitter';
export {
  PluginEventEmitter,
} from './6-facade/PluginEventEmitter';

// === Orchestrator (オーケストレーター) ===
export type {
  OrchestrationConfig,
  OrchestrationResult,
} from './orchestrator/PluginOrchestrator';
export {
  PluginOrchestrator,
} from './orchestrator/PluginOrchestrator';

export type {
  WorkerBootstrapConfig,
} from './orchestrator/WorkerPluginBootstrapper';
export {
  WorkerPluginBootstrapper,
  initializePluginSystemInWorker,
  getWorkerPluginAPI,
  resetWorkerPluginSystem,
} from './orchestrator/WorkerPluginBootstrapper';

// === 型定義 ===
export type {
  PluginIntegrated,
  PluginDefinition,
  NodeType,
  EntityHandler,
} from '@hierarchidb/common-type';