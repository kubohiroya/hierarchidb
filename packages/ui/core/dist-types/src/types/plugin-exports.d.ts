import type { ComponentType } from 'react';
export type PluginDialogProps = {
    open: boolean;
    onClose: () => void;
    mode?: 'create' | 'edit';
    nodeId?: string;
    parentId?: string;
    treeId?: string;
    onSuccess?: (entity: unknown) => void;
    onError?: (error: Error) => void;
} & Record<string, unknown>;
export type PluginPanelProps = Record<string, unknown>;
export type PluginDialogComponent = ComponentType<PluginDialogProps>;
export type PluginPanelComponent = ComponentType<PluginPanelProps>;
//# sourceMappingURL=plugin-exports.d.ts.map