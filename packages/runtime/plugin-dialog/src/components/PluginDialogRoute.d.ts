/**
 * Plugin Dialog Route Component
 * Integrates plugin dialogs with React Router
 */
import React from 'react';
import { NodeId, TreeId } from '@hierarchidb/common-types';
interface PluginDialogLoaderData {
    tree: {
        id: TreeId;
    };
    pageNodeId: NodeId;
    targetNodeId: NodeId;
    targetNode?: unknown;
    nodeType: string;
    action: string;
}
/**
 * Plugin Dialog Route Component
 * This component should be used in React Router route definitions
 */
export interface PluginDialogRouteProps {
    loaderData?: PluginDialogLoaderData;
}
export declare const PluginDialogRoute: React.FC<PluginDialogRouteProps>;
/**
 * Create route configuration for plugin dialogs
 * Uses the existing route pattern: /t/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action
 */
export declare function createPluginDialogRoutes(): {
    path: string;
    element: import("react/jsx-runtime").JSX.Element;
}[];
export {};
//# sourceMappingURL=PluginDialogRoute.d.ts.map