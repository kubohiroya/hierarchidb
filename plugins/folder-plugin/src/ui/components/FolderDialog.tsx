import type React from 'react';
import { useEffect } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import { ExtensibleFolderDialog } from './ExtensibleFolderDialog.js';
import { useWorkingCopy } from '@hierarchidb/ui-plugin-dialog';
import { notify } from '@hierarchidb/components';

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
  const { init, commit, discard } = useWorkingCopy({
    nodeType: 'folder',
    mode,
    nodeId: nodeId ? String(nodeId) : undefined,
    parentId: parentId ? String(parentId) : undefined,
  });
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
        await discard();
        notify.info('Folder changes discarded');
        onClose();
      }}
    />
  );
};
