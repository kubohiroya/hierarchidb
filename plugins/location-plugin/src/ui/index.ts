import React from 'react';
import { toNodeId } from '@hierarchidb/common-types';
import type { LocationDialogProps } from '../common/types/index.js';
import type { LocationPanelProps } from '../common/components/LocationPanel.js';

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

const toOptionalNodeId = (value: HostPluginDialogProps['nodeId']): LocationDialogProps['nodeId'] =>
  typeof value === 'string' ? toNodeId(value) : undefined;

const isVoidFn = (value: unknown): value is () => void => typeof value === 'function';

export async function getDialogComponent(): Promise<PluginDialogComponent> {
  const Adapter: PluginDialogComponent = () => {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(
        '[location-plugin] getDialogComponent() is deprecated. Dialogs are now provided via PluginDialogHost.'
      );
    }
    return null;
  };
  return Adapter;
}

export async function getPanelComponent(): Promise<PluginPanelComponent> {
  const { LocationPanel } = await import('../common/components/LocationPanel.js');

  const Adapter: PluginPanelComponent = (props: HostPluginPanelProps) => {
    const rawNodeId = props['nodeId'];
    const nodeId = toOptionalNodeId(rawNodeId);
    if (!nodeId) {
      throw new Error('LocationPanel requires `nodeId` string prop.');
    }

    const rawOnEdit = props['onEdit'];
    const onEdit = isVoidFn(rawOnEdit) ? rawOnEdit : undefined;

    return React.createElement(LocationPanel, {
      nodeId,
      onEdit,
    } satisfies LocationPanelProps);
  };

  return Adapter;
}

// Register host-composed steps on import (idempotent)
import './components/steps-provider.js';
