import React from 'react';
import type { PluginDialogComponent, PluginDialogProps, PluginPanelComponent, PluginPanelProps } from '@hierarchidb/ui-core';
import { toNodeId } from '@hierarchidb/common-types';
import type { LocationDialogProps, LocationWorkingCopy } from '../types/index.js';
import type { LocationPanelProps } from '../components/LocationPanel.js';

const toOptionalNodeId = (value: unknown): LocationDialogProps['nodeId'] =>
  typeof value === 'string' ? toNodeId(value) : undefined;

const isVoidFn = (value: unknown): value is () => void => typeof value === 'function';

export async function getDialogComponent(): Promise<PluginDialogComponent> {
  const { LocationDialog } = await import('../components/LocationDialog.js');

  const Adapter: PluginDialogComponent = (props: PluginDialogProps) => {
    const { open, onClose, mode = 'create', nodeId, parentId, onSuccess, onError } = props;
    const normalizedMode: LocationDialogProps['mode'] = mode === 'edit' ? 'edit' : 'create';

    const handleSuccess = onSuccess
      ? (entity: LocationWorkingCopy) => {
          onSuccess(entity);
        }
      : undefined;

    return React.createElement(LocationDialog, {
      mode: normalizedMode,
      nodeId: toOptionalNodeId(nodeId),
      parentId: toOptionalNodeId(parentId),
      open,
      onClose,
      onSuccess: handleSuccess,
      onError,
    } satisfies LocationDialogProps);
  };

  return Adapter;
}

export async function getPanelComponent(): Promise<PluginPanelComponent> {
  const { LocationPanel } = await import('../components/LocationPanel.js');

  const Adapter: PluginPanelComponent = (props: PluginPanelProps) => {
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
import './steps-provider';
