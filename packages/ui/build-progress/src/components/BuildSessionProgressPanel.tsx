import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { BuildProgressPanel, type BuildProgressPanelProps } from './BuildProgressPanel.js';

type BuildSessionStateDialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  message: ReactNode;
  closeLabel?: ReactNode;
};

type BuildSessionCompletionDialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  content: ReactNode;
  closeLabel?: ReactNode;
};

export type BuildSessionProgressPanelProps = BuildProgressPanelProps & {
  suspendDialog?: BuildSessionStateDialogProps;
  crashDialog?: BuildSessionStateDialogProps;
  completionDialog?: BuildSessionCompletionDialogProps;
};

const BuildSessionStateDialog = ({
  open,
  onClose,
  title,
  message,
  closeLabel,
}: BuildSessionStateDialogProps) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {typeof message === 'string' ? <Typography variant="body2">{message}</Typography> : message}
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose} variant="contained">
        {closeLabel ?? 'Close'}
      </Button>
    </DialogActions>
  </Dialog>
);

export const BuildSessionProgressPanel: React.FC<BuildSessionProgressPanelProps> = ({
  suspendDialog,
  crashDialog,
  completionDialog,
  footer,
  ...panelProps
}) => {
  const mergedFooter = (
    <>
      {footer}
      {suspendDialog ? (
        <BuildSessionStateDialog
          open={suspendDialog.open}
          onClose={suspendDialog.onClose}
          title={suspendDialog.title}
          message={suspendDialog.message}
          closeLabel={suspendDialog.closeLabel}
        />
      ) : null}
      {crashDialog ? (
        <BuildSessionStateDialog
          open={crashDialog.open}
          onClose={crashDialog.onClose}
          title={crashDialog.title}
          message={crashDialog.message}
          closeLabel={crashDialog.closeLabel}
        />
      ) : null}
      {completionDialog ? (
        <Dialog
          open={completionDialog.open}
          onClose={completionDialog.onClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>{completionDialog.title}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {completionDialog.content}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={completionDialog.onClose} variant="contained">
              {completionDialog.closeLabel ?? 'Close'}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </>
  );

  return <BuildProgressPanel {...panelProps} footer={mergedFooter} />;
};
