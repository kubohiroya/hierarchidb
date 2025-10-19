/**
 * @file PluginManagementAPI.ts
 * @description Plugin lifecycle management API
 *
 * This API handles plugin registration, unregistration, validation, and health monitoring.
 * It's focused on the management aspects of plugin-loader, separated from node type queries.
 */
import type { NodeType } from '@hierarchidb/common-types';
import { PluginDefinition } from './plugin-definition.js';
export interface PluginRegistrationResult {
    success: boolean;
    pluginId?: string;
    registeredNodeType?: NodeType;
    error?: {
        code: string;
        message: string;
    };
    validationErrors?: Array<{
        field: string;
        message: string;
    }>;
}
export interface UnregistrationResult {
    success: boolean;
    unregisteredNodeType?: NodeType;
    warnings?: string[];
    error?: {
        code: string;
        message: string;
    };
}
export interface PluginValidationResult {
    isValid: boolean;
    errors: Array<{
        field: string;
        message: string;
        severity: 'error' | 'warning' | 'info';
    }>;
    warnings: Array<{
        field: string;
        message: string;
    }>;
}
export interface PluginHealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
    issues?: string[];
    performance: {
        avgResponseTime: number;
        errorRate: number;
    };
}
export interface PluginRegistrationInfo {
    nodeType: NodeType;
    meta: {
        name: string;
        version: string;
        category?: string;
    };
    registrationTime: number;
    healthStatus: PluginHealthStatus;
}
export interface PluginListOptions {
    status?: 'healthy' | 'degraded' | 'unhealthy';
    category?: string;
}
export interface PluginDependencyInfo {
    nodeType: NodeType;
    dependencies: NodeType[];
    dependents: NodeType[];
    circularDependencies: boolean;
    warnings?: string[];
}
export interface BulkOperationOptions {
    operation: 'register' | 'unregister';
    plugins?: PluginDefinition[];
    nodeTypes?: NodeType[];
}
export interface BulkOperationResult {
    successful: Array<{
        nodeType: NodeType;
        result: any;
    }>;
    failed: Array<{
        nodeType: NodeType;
        error: string;
    }>;
    summary: {
        total: number;
        success: number;
        failed: number;
    };
}
export interface PluginResetOptions {
    nodeType: NodeType;
    resetMode: 'individual' | 'folder' | 'system';
    createBackup?: boolean;
}
export interface PluginResetResult {
    success: boolean;
    nodeType: NodeType;
    deletedEntities: {
        groupEntities?: number;
        relationalEntities?: number;
        treeNodes?: number;
        peerEntities?: number;
    };
    backupLocation?: string;
    error?: {
        code: string;
        message: string;
    };
}
export interface PluginDeleteResult {
    success: boolean;
    nodeType: NodeType;
    warnings?: string[];
    error?: {
        code: string;
        message: string;
    };
}
/**
 * Plugin lifecycle management API
 *
 * Provides comprehensive plugin management functionality including registration,
 * validation, health monitoring, and dependency management.
 *
 * @example
 * ```typescript
 * const pluginMgmtAPI = workerAPI.getPluginManagementAPI();
 *
 * // Register a new plugin
 * const result = await pluginMgmtAPI.register(myPluginDefinition);
 *
 * // Check plugin health
 * const health = await pluginMgmtAPI.checkHealth('folder-plugin');
 * ```
 */
export interface PluginLifecycleAPI {
    /**
     * Register a plugin definition with the runtime.
     * @param definition - Plugin manifest and wiring information to register.
     * @returns A promise that resolves with registration details including the assigned node type.
     */
    register(definition: PluginDefinition): Promise<PluginRegistrationResult>;
    /**
     * Unregister an existing plugin by node type.
     * @param nodeType - Node type identifier that should be removed from the registry.
     * @returns A promise containing information about the unregistered plugin.
     */
    unregister(nodeType: NodeType): Promise<UnregistrationResult>;
    /**
     * Run validation against a plugin definition without registering it.
     * @param definition - Plugin definition to validate for structural and dependency issues.
     * @returns Validation details including errors and warnings, if any.
     */
    validatePlugin(definition: PluginDefinition): Promise<PluginValidationResult>;
    /**
     * Retrieve health metrics for a registered plugin.
     * @param nodeType - Node type identifier whose health information should be returned.
     * @returns A promise with current health status metrics.
     */
    checkHealth(nodeType: NodeType): Promise<PluginHealthStatus>;
    /**
     * List registered plugins with optional filtering.
     * @param options - Filter options such as status or category. When omitted, all plugins are returned.
     * @returns A promise that resolves with metadata for each registered plugin.
     */
    listRegistered(options?: PluginListOptions): Promise<PluginRegistrationInfo[]>;
    /**
     * Inspect dependency information for a specific plugin.
     * @param nodeType - Node type whose dependency graph should be returned.
     * @returns A promise describing dependencies, dependents, and any circular references.
     */
    getDependencies(nodeType: NodeType): Promise<PluginDependencyInfo>;
    /**
     * Execute a bulk registration or unregistration operation.
     * @param options - Bulk operation configuration describing the target plugins and action.
     * @returns A promise summarising successes and failures for the bulk request.
     */
    bulkOperation(options: BulkOperationOptions): Promise<BulkOperationResult>;
    /**
     * Reset a plugin to a known baseline.
     * @param options - Reset configuration including node type, reset mode, and optional backup behaviour.
     * @returns A promise with details about the reset operation.
     */
    resetPlugin(options: PluginResetOptions): Promise<PluginResetResult>;
    /**
     * Permanently remove a plugin from the system.
     * @param nodeType - Node type identifier to delete from the registry.
     * @returns A promise describing the outcome of the delete operation.
     */
    deletePlugin(nodeType: NodeType): Promise<PluginDeleteResult>;
    /**
     * Perform a system-wide reset for all plugins.
     * @param createBackup - Whether to produce a backup before resetting.
     * @returns A promise detailing the result of the reset operation.
     */
    resetSystem(createBackup?: boolean): Promise<PluginResetResult>;
}
//# sourceMappingURL=PluginLifecycleAPI.d.ts.map