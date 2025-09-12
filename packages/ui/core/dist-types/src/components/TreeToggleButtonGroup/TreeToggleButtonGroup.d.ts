/**
 * @file TreeToggleButtonGroup.tsx
 * @description Flexible button group for toggling between multiple tree pages
 */
import React from 'react';
export type ButtonGroupOrientation = 'horizontal' | 'vertical';
export type ButtonGroupSize = 'small' | 'medium' | 'large';
/**
 * TreeTypes configuration for button group
 */
export interface TreeConfig {
    /** Unique identifier for the tree */
    id: string;
    /** Display label for the button */
    label: string;
    /** Icon component to display */
    icon: React.ComponentType<any>;
    /** Route path segment (e.g., 'r' for resources, 'p' for projects) */
    routePath: string;
    /** MUI color for the button */
    color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
    /** Tooltip text (defaults to label if not provided) */
    tooltip?: string;
    /** Whether this tree option is disabled */
    disabled?: boolean;
}
/**
 * Props for TreeToggleButtonGroup
 */
export interface TreeToggleButtonGroupProps {
    /** Array of tree configurations */
    trees: TreeConfig[];
    /** Currently selected tree ID (null for neutral state) */
    selectedTreeId: string | null;
    /** Current page node ID to preserve */
    currentPageNodeId?: string;
    /** App prefix for routing (optional, only needed if not using React Router basename) */
    appPrefix?: string;
    /** Callback to get saved page node ID for a given tree */
    getSavedPageNodeId: (treeId: string) => string | null;
    /** Callback to save page node ID for a given tree */
    savePageNodeId: (treeId: string, pageNodeId: string) => void;
    /** Optional callback to validate which tree a node belongs to */
    getNodeTreeId?: (pageNodeId: string) => Promise<string | null>;
    /** Button group orientation */
    orientation?: ButtonGroupOrientation;
    /** Button size */
    size?: ButtonGroupSize;
    /** Whether to show button labels on small screens */
    showLabelsOnSmallScreens?: boolean;
    /** Custom styles for the button group */
    sx?: any;
    /** Callback when a tree is selected */
    onTreeSelect?: (treeId: string) => void;
}
/**
 * Flexible tree toggle button group component
 */
export declare function TreeToggleButtonGroup({ trees, selectedTreeId, currentPageNodeId, appPrefix, getSavedPageNodeId, savePageNodeId, getNodeTreeId, orientation, size, showLabelsOnSmallScreens, sx, onTreeSelect, }: TreeToggleButtonGroupProps): JSX.Element | null;
/**
 * Helper function to create a tree config for resources
 */
export declare function createResourcesTreeConfig(icon: React.ComponentType<any>, overrides?: Partial<TreeConfig>): TreeConfig;
/**
 * Helper function to create a tree config for projects
 */
export declare function createProjectsTreeConfig(icon: React.ComponentType<any>, overrides?: Partial<TreeConfig>): TreeConfig;
//# sourceMappingURL=TreeToggleButtonGroup.d.ts.map