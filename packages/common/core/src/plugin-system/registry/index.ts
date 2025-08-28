/**
 * Plugin registry and dependency management
 * 
 * This module provides:
 * - NodeDefinitionRegistry: Manages node type definitions
 * - DependencyResolver: Resolves plugin dependencies and load order
 * - DatabaseManager: Manages plugin-specific database operations
 */

// Node definition registry
export { NodeDefinitionRegistry } from '../../registry/NodeDefinitionRegistry';

// Dependency resolution
export { PluginDependencyResolver } from './DependencyResolver';

// Database management interfaces
export * from './DatabaseManager';