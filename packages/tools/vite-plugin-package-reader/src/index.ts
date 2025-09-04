// Core exports
export { vitePluginPackageReader } from './plugin/VitePlugin';
export { Logger } from './core/Logger';
export { PackageCache } from './core/PackageCache';
export { PackageDetector } from './core/PackageDetector';

// Strategy exports
export {
  BaseStrategy,
  RegexStrategy,
  FieldStrategy,
  CompositeStrategy,
  FunctionStrategy,
} from './strategies';

// Pipeline exports
export { TransformPipeline } from './pipeline/TransformPipeline';
export { DependencyResolver } from './pipeline/DependencyResolver';

// Virtual module exports
export { VirtualModuleManager } from './virtual/VirtualModuleManager';
export { TypeGenerator } from './virtual/TypeGenerator';

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
} from './types';
