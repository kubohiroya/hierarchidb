import type { CreateMenuItem, CreateMenuItemOrDivider, NodeId } from '@hierarchidb/common-type';
import { NodeDataAdapter } from '../adapters/NodeDataAdapter';
/**
 * Dynamic Create Menu Hook
 *
 * Generates context-aware create menu items based on:
 * - Parent node capabilities
 * - Available plugins
 * - User permissions
 * - Worker-side restrictions
 */
export declare function useDynamicCreateMenu(parentId: NodeId, nodeAdapter: NodeDataAdapter): {
    readonly menuItems: readonly CreateMenuItemOrDivider[];
    readonly loading: boolean;
    readonly error: string | null;
};
/**
 * Create Menu Item Component Hook
 *
 * Provides create functionality for menu items
 */
export declare function useCreateMenuItem(_nodeAdapter: NodeDataAdapter, unifiedOperations: any): (parentId: NodeId, nodeType: string) => CreateMenuItem;
//# sourceMappingURL=useDynamicCreateMenu.d.ts.map