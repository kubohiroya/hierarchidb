import React, { useEffect } from 'react';
import type { NodeId } from '@hierarchidb/common-type';
import { ExtensibleFolderDialog } from './ExtensibleFolderDialog';
import { notify, useWorkingCopy } from '@hierarchidb/ui-core';

export interface FolderDialogProps {
  open: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
  onSuccess?: (entity: unknown) => void;
  onError?: (error: Error) => void;
}

export const FolderDialog: React.FC<FolderDialogProps> = ({ open, onClose, mode = 'create', nodeId, parentId, onSuccess, onError }) => {
  const { init, commit, discard } = useWorkingCopy({ nodeType: 'folder', mode, nodeId: nodeId as any, parentId: parentId as any });
  useEffect(() => { if (open) void init(); }, [open, init]);
  useEffect(() => { return () => { void discard().catch(() => {}); }; }, [discard]);

  return (
    <ExtensibleFolderDialog
      mode={mode}
      nodeId={nodeId}
      parentId={parentId}
      open={open}
      onSubmit={async () => {
        try {
          await commit();
          onSuccess?.(null);
          notify.success('Folder saved successfully');
        } catch (e) {
          onError?.(e as Error);
          notify.error('Failed to save folder');
        } finally {
          onClose();
        }
      }}
      onCancel={async () => {
        try { await discard(); } catch {}
        notify.info('Folder changes discarded');
        onClose();
      }}
    />
  );
};
