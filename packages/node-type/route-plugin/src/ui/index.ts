// Standardized UI-side exports (polymorphic contract)
import { createElement } from 'react';
import type { PluginDialogComponent, PluginDialogProps, PluginPanelComponent, PluginPanelProps } from '@hierarchidb/ui-core';
import type { NodeId } from '@hierarchidb/common-type';
import type { RouteEntity } from '../types/index.js';
import type { RouteDialogProps } from '../components/RouteDialog.js';
import type { RoutePanelProps } from '../components/RoutePanel.js';

export async function getDialogComponent(): Promise<PluginDialogComponent> {
  const { RouteDialog } = await import('../components/RouteDialog.js');
  const Adapter: PluginDialogComponent = (props) => createElement(RouteDialog, adaptDialogProps(props));
  return Adapter;
}

export async function getPanelComponent(): Promise<PluginPanelComponent> {
  const { RoutePanel } = await import('../components/RoutePanel.js');
  const Adapter: PluginPanelComponent = (props) => createElement(RoutePanel, toRoutePanelProps(props));
  return Adapter;
}

// Register host-composed steps on import (idempotent in registry)
import './steps-provider';

function toOptionalNodeId(value: PluginDialogProps['nodeId']): NodeId | undefined {
  return typeof value === 'string' && value.length > 0 ? (value as NodeId) : undefined;
}

function adaptDialogProps(props: PluginDialogProps): RouteDialogProps {
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

function toRoutePanelProps(props: PluginPanelProps): RoutePanelProps {
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
