import type { NodeId } from '@hierarchidb/common-type';
import type { NodeDataAdapter } from '../adapters/NodeDataAdapter.js';
export interface DynamicCreateMenuProps {
    /**
     * Parent node where new items will be created
     */
    readonly parentId: NodeId;
    /**
     * Anchor element for the menu
     */
    readonly anchorEl: HTMLElement | null;
    /**
     * Whether the menu is open
     */
    readonly open: boolean;
    /**
     * Called when the menu should be closed
     */
    readonly onClose: () => void;
    /**
     * Called when a create action is triggered
     */
    readonly onCreate: (parentId: NodeId, nodeType: string) => void;
    /**
     * Node data adapter for fetching data
     */
    readonly nodeAdapter: NodeDataAdapter;
    /**
     * Menu positioning configuration
     */
    readonly positioning?: {
        readonly anchorOrigin?: {
            readonly vertical: 'top' | 'center' | 'bottom';
            readonly horizontal: 'left' | 'center' | 'right';
        };
        readonly transformOrigin?: {
            readonly vertical: 'top' | 'center' | 'bottom';
            readonly horizontal: 'left' | 'center' | 'right';
        };
    };
}
/**
 * Dynamic Create Menu Component
 *
 * Renders a context-aware menu of items that can be created in the specified parent node.
 * The menu items are dynamically output based on:
 * - Available UI plugins
 * - Parent node capabilities
 * - User permissions
 * - Worker layer restrictions
 */
export declare const DynamicCreateMenu: React.FC<DynamicCreateMenuProps>;
/**
 * Simplified version for quick integration
 */
export interface SimpleDynamicCreateMenuProps {
    readonly parentId: NodeId;
    readonly anchorEl: HTMLElement | null;
    readonly open: boolean;
    readonly onClose: () => void;
    readonly onCreate: (parentId: NodeId, nodeType: string) => void;
    readonly nodeAdapter: NodeDataAdapter;
}
export declare const SimpleDynamicCreateMenu: React.FC<SimpleDynamicCreateMenuProps>;
//# sourceMappingURL=DynamicCreateMenu.d.ts.map