/**
 * Node definition with entity handler
 * Combines core node definition with worker-side entity handler
 */
import type { NodeType, TreeId, PeerEntity, ValidationRule } from '@hierarchidb/common-types';
export interface PluginDefinition {
    readonly nodeType: NodeType;
    readonly name: string;
    readonly displayName: string;
    readonly description?: string;
    readonly visibility?: {
        showInCreateMenu?: boolean;
        showInPluginList?: boolean;
    };
    readonly i18n?: PluginI18nConfig;
    readonly icon?: NodeTypeIconDefinition;
    readonly category: CategoryDefinition;
    readonly database: PluginDatabaseConfig;
    readonly ui?: PluginUIConfig;
    readonly api?: PluginAPIConfig;
    readonly validation?: PluginValidationConfig;
    readonly extends?: string;
    readonly dependencies: string[];
    readonly priority: number;
    readonly version: string;
}
export interface NodeTypeIconDefinition {
    muiIconName?: string;
    emoji?: string;
    svg?: string;
    svgPath?: string;
    description?: string;
    color?: string;
}
/**
 * Category definition for plugin-loader
 * Defines which tree(s) a plugin should be available in
 */
export interface CategoryDefinition {
    readonly treeId: TreeId | '*';
    readonly menuGroup?: 'basic' | 'container' | 'document' | 'advanced';
    readonly createOrder?: number;
}
/**
 * Node capability definition
 * Defines what operations and features a node type supports
 */
export type NodeCapability = 'create' | 'read' | 'update' | 'delete' | 'move' | 'copy' | 'export' | 'import' | 'children' | 'references' | 'validation' | 'lifecycle' | 'search' | 'sync' | 'offline';
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface WorkerPluginRouterAction {
    path?: string;
    loader?: () => Promise<unknown>;
    action?: () => Promise<unknown>;
    componentPath?: string;
}
export interface PluginDatabaseConfig {
    dbName: string;
    entityStore?: string;
    schema: DatabaseSchema;
    version: number;
}
export interface PluginUIConfig {
    dialogComponentPath?: string;
    panelComponentPath?: string;
    formComponentPath?: string;
    iconComponentPath?: string;
}
export interface PluginAPIConfig {
    workerExtensions?: Record<string, (...args: unknown[]) => Promise<unknown>>;
    clientExtensions?: Record<string, (...args: unknown[]) => Promise<unknown>>;
}
export interface PluginValidationConfig<TEntity extends PeerEntity = PeerEntity> {
    namePattern?: RegExp;
    maxChildren?: number;
    allowedChildTypes?: NodeType[];
    customValidators?: ValidationRule<TEntity>[];
}
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface PluginI18nConfig {
    namespace?: string;
    defaultLocale?: string;
    localesPath?: string;
    resources?: {
        [locale: string]: {
            menuItem?: {
                title?: string;
                tooltip?: string;
            };
            dialog?: {
                title?: string;
                description?: string;
                createButton?: string;
                cancelButton?: string;
            };
            panel?: {
                title?: string;
                description?: string;
            };
            speedDial?: {
                tooltip?: string;
            };
            [key: string]: any;
        };
    };
}
export interface DatabaseSchema {
    [storeName: string]: string;
}
export interface PluginRoutingConfig {
    actions: Record<string, WorkerPluginRouterAction>;
    defaultAction?: string;
}
//# sourceMappingURL=plugin-definition.d.ts.map