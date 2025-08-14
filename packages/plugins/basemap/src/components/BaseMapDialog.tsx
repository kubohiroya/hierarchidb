/**
 * @file BaseMapDialog.tsx
 * @description BaseMap dialog component for create/edit operations
 */

import React from 'react';
import BaseMapEditor from './BaseMapEditor';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';
import type { TreeNodeId } from '@hierarchidb/core';

export interface BaseMapDialogProps {
  open: boolean;
  nodeId?: TreeNodeId;
  entity?: BaseMapEntity;
  workingCopy?: BaseMapWorkingCopy;
  onClose: () => void;
  onSave: (data: Partial<BaseMapEntity>) => void;
}

export const BaseMapDialog: React.FC<BaseMapDialogProps> = ({
  open,
  nodeId,
  entity,
  workingCopy,
  onClose,
  onSave,
}) => {
  if (!open) return null;

  return (
    <div className="basemap-dialog-overlay" onClick={onClose}>
      <div className="basemap-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="basemap-dialog-header">
          <h2>{entity ? 'Edit BaseMap' : 'Create BaseMap'}</h2>
          <button onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="basemap-dialog-content">
          <BaseMapEditor
            nodeId={nodeId}
            entity={entity}
            workingCopy={workingCopy}
            onSave={onSave}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default BaseMapDialog;
