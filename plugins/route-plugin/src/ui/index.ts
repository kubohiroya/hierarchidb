// Standardized UI-side exports (polymorphic contract)
import { createElement } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import type { RouteEntity } from '../common/types/index.js';
import type { RouteDialogProps } from '../common/components/RouteDialog.js';
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
  const { RouteDialog } = await import('../common/components/RouteDialog.js');
  const Adapter: PluginDialogComponent = (props: HostPluginDialogProps) =>
    createElement(RouteDialog, adaptDialogProps(props));
  return Adapter;
}

export async function getPanelComponent(): Promise<PluginPanelComponent> {
  const { RoutePanel } = await import('../common/components/RoutePanel.js');
  const Adapter: PluginPanelComponent = (props: HostPluginPanelProps) =>
    createElement(RoutePanel, toRoutePanelProps(props));
  return Adapter;
}

// Register host-composed steps on import (idempotent in registry)
import './steps-provider';

function toOptionalNodeId(value: HostPluginDialogProps['nodeId']): NodeId | undefined {
  return typeof value === 'string' && value.length > 0 ? (value as NodeId) : undefined;
}

function adaptDialogProps(props: HostPluginDialogProps): RouteDialogProps {
  return {
    open: props.open,
    onClose: props.onClose,
    mode: props.mode === 'edit' ? 'edit' : 'create',
    nodeId: toOptionalNodeId(props.nodeId),
    parentId: toOptionalNodeId(props.parentId),
    onSuccess: (entity) => props.onSuccess?.(entity),
    onError: props.onError,
  };
}

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
