import type { ComponentType } from 'react';

// Minimal, stable props surface for plugin dialog/panel components.
// Concrete plugin-loader may accept追加 propsだが、公開境界ではこれ以上を約束しない。

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
