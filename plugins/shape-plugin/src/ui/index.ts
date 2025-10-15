import { createElement } from 'react';
import type { PluginDialogComponent, PluginDialogProps, PluginPanelComponent, PluginPanelProps } from '@hierarchidb/ui-core';
import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeEntity } from '../shared/index.ts';
import type { ShapeDialogProps } from '../ui/components/ShapeDialog.js';
import type { ShapeViewPanelProps } from '../ui/components/ShapeViewPanel.js';

export async function getDialogComponent(): Promise<PluginDialogComponent> {
  const { ShapeDialog } = await import('../ui/components/ShapeDialog.js');
  const Adapter: PluginDialogComponent = (props) => createElement(ShapeDialog, adaptDialogProps(props));
  return Adapter;
}

export async function getPanelComponent(): Promise<PluginPanelComponent> {
  const { ShapeViewPanel } = await import('../ui/components/ShapeViewPanel.js');
  const Adapter: PluginPanelComponent = (props) => createElement(ShapeViewPanel, adaptPanelProps(props));
  return Adapter;
}

// Register host-composed steps using existing step components (idempotent)
import './steps-provider';

function adaptDialogProps(props: PluginDialogProps): ShapeDialogProps {
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

function adaptPanelProps(props: PluginPanelProps): ShapeViewPanelProps {
  const record = props as Record<string, unknown>;
  const nodeId = record.nodeId;
  const entity = record.entity;
  if (typeof nodeId !== 'string') throw new Error('ShapeViewPanel requires nodeId');
  if (!entity || typeof entity !== 'object') {
    throw new Error('ShapeViewPanel requires entity payload');
  }

  return {
    nodeId: nodeId as NodeId,
    entity: entity as ShapeEntity,
    onEdit: typeof record.onEdit === 'function' ? (record.onEdit as () => void) : () => {},
    onRefresh: typeof record.onRefresh === 'function' ? (record.onRefresh as () => void) : () => {},
  };
}

function toOptionalNodeId(value: PluginDialogProps['nodeId']): NodeId | undefined {
  return typeof value === 'string' && value.length > 0 ? (value as NodeId) : undefined;
}
