/**
 * @file BaseMapDialog.tsx
 * @description BaseMap dialog component for create/edit operations
 */

import React from 'react';
import { BaseMapStepperDialog } from './BaseMapStepperDialog';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';
import type { NodeId } from '@hierarchidb/common-core';

export interface BaseMapDialogProps {
  open: boolean;
  nodeId?: NodeId;
  entity?: BaseMapEntity;
  workingCopy?: BaseMapWorkingCopy;
  onClose: () => void;
  onSave: (data: Partial<BaseMapEntity>) => void;
  mode?: 'create' | 'edit';
}

export const BaseMapDialog: React.FC<BaseMapDialogProps> = ({
  open,
  nodeId,
  entity,
  workingCopy,
  onClose,
  onSave,
  mode = 'create',
}) => {
  return (
    <BaseMapStepperDialog
      open={open}
      nodeId={nodeId}
      entity={entity}
      workingCopy={workingCopy}
      onClose={onClose}
      onSave={onSave}
      mode={mode}
    />
  );
};

export default BaseMapDialog;