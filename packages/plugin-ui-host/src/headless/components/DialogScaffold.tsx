import React, { memo } from 'react';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Button,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { PluginDialogHeader } from './PluginDialogHeader.js';
import { PluginDialogFooter, type PluginDialogFooterProps } from './PluginDialogFooter.js';
import type { DialogActionInFlight } from '../types.js';

export const createHeaderComponent = (
  title: string,
  subtitle: string | undefined,
  icon: React.ReactNode | undefined,
  pendingAction: DialogActionInFlight | null,
) =>
  memo(() => (
    <PluginDialogHeader title={title} subtitle={subtitle} icon={icon || undefined} pendingAction={pendingAction} />
  ));

export const createContentComponent = (dialogRef: React.RefObject<HTMLElement | null>) =>
  memo(
    function DialogContentWrapper(props: React.PropsWithChildren) {
      return (
        <Box
          sx={(theme: Theme) => ({
            flex: 1,
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            padding: theme.spacing(2),
          })}
          ref={dialogRef}
        >
          {props.children}
        </Box>
      );
    },
  );

export const createFooterComponent = (footerPropsRef: React.MutableRefObject<PluginDialogFooterProps>) =>
  memo(function DialogFooterWrapper() {
    return <PluginDialogFooter {...footerPropsRef.current} />;
  });

export interface ConflictDialogProps {
  open: boolean;
  updatedAt: number | null;
  foregroundSx: Record<string, unknown>;
  resolveConflict: (action: 'continue' | 'discard') => void;
  formatTimestamp: (ts?: number) => string;
  translate: (key: string, opts?: Record<string, unknown>) => string;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  open,
  updatedAt,
  foregroundSx,
  resolveConflict,
  formatTimestamp,
  translate,
}) => {
  return (
    <Dialog
      open={open}
      onClose={() => {
        resolveConflict('continue');
      }}
      sx={{
        ...foregroundSx,
        zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 1001,
      }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(9, 12, 28, 0.45)',
            zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 1000,
          },
        },
        paper: {
          sx: { zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 1002 },
        },
      }}
    >
      <DialogTitle>{translate('dialogs.pluginDraft.conflict.title')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          {translate('dialogs.pluginDraft.conflict.description', {
            timestamp: formatTimestamp(updatedAt ?? undefined),
          })}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          color="secondary"
          onClick={() => {
            resolveConflict('discard');
          }}
        >
          {translate('dialogs.pluginDraft.conflict.buttons.discardSelf')}
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            resolveConflict('continue');
          }}
        >
          {translate('dialogs.pluginDraft.conflict.buttons.keepSelf')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
