// Core exports
export { vitePluginPackageReader } from './plugin/VitePlugin.js';
export { Logger } from './core/Logger.js';
export { PackageCache } from './core/PackageCache.js';
export { PackageDetector } from './core/PackageDetector.js';

// Strategy exports
export {
  BaseStrategy,
  RegexStrategy,
  FieldStrategy,
  CompositeStrategy,
  FunctionStrategy,
} from './strategies/index.js';

// Pipeline exports
export { TransformPipeline } from './pipeline/TransformPipeline.js';
export { DependencyResolver } from './pipeline/DependencyResolver.js';

// Virtual module exports
export { VirtualModuleManager } from './virtual/VirtualModuleManager.js';
export { TypeGenerator } from './virtual/TypeGenerator.js';

// Type exports
export type {
  PackageJson,
  PackageDetectionStrategy,
  TransformPipelineOptions,
  VirtualModuleGenerator,
  Hooks,
  MonorepoOptions,
  LogLevel,
  LoggerOptions,
  VitePluginPackageReaderOptions,
  VitePluginPackageReaderAPI,
  VitePluginWithAPI,
} from './types.js';
