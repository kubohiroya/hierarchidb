/**
 * TrashbinActions - ゴミ箱操作用のアクションボタン群
 *
 * 復元・完全削除・空にするなどのアクション
 */

import { useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import {
  Restore as RestoreIcon,
  DeleteForever as DeleteForeverIcon,
  Delete as EmptyTrashIcon,
} from '@mui/icons-material';
import type { TrashbinActionsProps } from '../types';

/**
 * TrashbinActions コンポーネント
 */
export function TrashbinActions({
  controller,
  selectedItemIds = new Set(),
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
  disableRestore = false,
  disableDelete = false,
  disableEmptyTrash = false,
  showConfirmations = true,
}: TrashbinActionsProps) {
  // Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'restore' | 'delete' | 'empty';
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    type: 'restore',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const selectedCount = selectedItemIds.size;
  const hasItems = (controller?.trashItems?.length || 0) > 0;

  // Action handlers
  const handleRestore = () => {
    const selectedIds = Array.from(selectedItemIds);

    if (showConfirmations && selectedCount > 0) {
      setConfirmDialog({
        open: true,
        type: 'restore',
        title: 'Restore Items',
        message: `Are you sure you want to restore ${selectedCount} item${selectedCount > 1 ? 's' : ''}?`,
        onConfirm: () => {
          controller?.onRestore?.(selectedIds);
          onRestore?.(selectedIds);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        },
      });
    } else if (selectedCount > 0) {
      controller?.onRestore?.(selectedIds);
      onRestore?.(selectedIds);
    }
  };

  const handlePermanentDelete = () => {
    const selectedIds = Array.from(selectedItemIds);

    if (showConfirmations && selectedCount > 0) {
      setConfirmDialog({
        open: true,
        type: 'delete',
        title: 'Permanently Delete Items',
        message: `Are you sure you want to permanently delete ${selectedCount} item${selectedCount > 1 ? 's' : ''}? This action cannot be undone.`,
        onConfirm: () => {
          controller?.onPermanentDelete?.(selectedIds);
          onPermanentDelete?.(selectedIds);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        },
      });
    } else if (selectedCount > 0) {
      controller?.onPermanentDelete?.(selectedIds);
      onPermanentDelete?.(selectedIds);
    }
  };

  const handleEmptyTrash = () => {
    if (showConfirmations && hasItems) {
      setConfirmDialog({
        open: true,
        type: 'empty',
        title: 'Empty Trash',
        message:
          'Are you sure you want to permanently delete all items in the trash? This action cannot be undone.',
        onConfirm: () => {
          controller?.onEmptyTrash?.();
          onEmptyTrash?.();
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        },
      });
    } else if (hasItems) {
      controller?.onEmptyTrash?.();
      onEmptyTrash?.();
    }
  };

  const handleDialogClose = () => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
        {/* Selection info */}
        {selectedCount > 0 && (
          <Typography variant="body2" color="text.secondary">
            {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
          </Typography>
        )}

        {/* Action buttons */}
        <Box sx={{ marginLeft: 'auto' }}>
          <ButtonGroup size="small" variant="outlined">
            <Button
              startIcon={<RestoreIcon />}
              onClick={handleRestore}
              disabled={disableRestore || selectedCount === 0}
              color="primary"
            >
              Restore {selectedCount > 0 ? `(${selectedCount})` : ''}
            </Button>

            <Button
              startIcon={<DeleteForeverIcon />}
              onClick={handlePermanentDelete}
              disabled={disableDelete || selectedCount === 0}
              color="error"
            >
              Delete Forever {selectedCount > 0 ? `(${selectedCount})` : ''}
            </Button>
          </ButtonGroup>

          <Button
            startIcon={<EmptyTrashIcon />}
            onClick={handleEmptyTrash}
            disabled={disableEmptyTrash || !hasItems}
            color="error"
            variant="outlined"
            sx={{ ml: 2 }}
          >
            Empty Trash
          </Button>
        </Box>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={handleDialogClose}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <DialogTitle id="confirm-dialog-title">{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-dialog-description">
            {confirmDialog.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={confirmDialog.onConfirm}
            color={confirmDialog.type === 'restore' ? 'primary' : 'error'}
            variant="contained"
            autoFocus
          >
            {confirmDialog.type === 'restore'
              ? 'Restore'
              : confirmDialog.type === 'delete'
                ? 'Delete Forever'
                : 'Empty Trash'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
