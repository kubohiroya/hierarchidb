// Standardized UI-side exports (polymorphic contract)
import { createElement } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import type { RouteEntity } from '../common/types/index.js';
import type { RoutePanelProps } from '../common/components/RoutePanel.js';

type PluginDialogComponent = (props: HostPluginDialogProps) => JSX.Element | null;
type PluginPanelComponent = (props: HostPluginPanelProps) => JSX.Element | null;

interface HostPluginDialogProps {
  open: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit' | string;
  nodeId?: unknown;
  parentId?: unknown;
  onSuccess?: (entity: unknown) => void;
  onError?: (error: Error) => void;
}

type HostPluginPanelProps = Record<string, unknown> & {
  nodeId?: unknown;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: () => void;
};

export async function getDialogComponent(): Promise<PluginDialogComponent> {
  const Adapter: PluginDialogComponent = () => {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[route-plugin] getDialogComponent() is deprecated. Dialogs are provided via PluginDialogHost.');
    }
    return null;
  };
  return Adapter;
}

export async function getPanelComponent(): Promise<PluginPanelComponent> {
  const { RoutePanel } = await import('../common/components/RoutePanel.js');
  const Adapter: PluginPanelComponent = (props: HostPluginPanelProps) =>
    createElement(RoutePanel, toRoutePanelProps(props));
  return Adapter;
}

// Register host-composed steps on import (idempotent in registry)
import './components/steps-provider.js';

function toRoutePanelProps(props: HostPluginPanelProps): RoutePanelProps {
  const record = props as Record<string, unknown>;
  const nodeId = record.nodeId;
  if (typeof nodeId !== 'string') throw new Error('RoutePanel requires nodeId');

  const entity = (record.entity ?? null) as RouteEntity | null;
  const onEdit = typeof record.onEdit === 'function' ? (record.onEdit as () => void) : () => {};
  const onDelete = typeof record.onDelete === 'function' ? (record.onDelete as () => void) : () => {};
  const onToggleVisibility = typeof record.onToggleVisibility === 'function'
    ? (record.onToggleVisibility as () => void)
    : () => {};

  return {
    nodeId: nodeId as NodeId,
    entity,
    onEdit,
    onDelete,
    onToggleVisibility,
  };
}
