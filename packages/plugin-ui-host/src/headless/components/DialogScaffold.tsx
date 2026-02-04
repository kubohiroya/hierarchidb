import { useDialogContext } from '@hierarchidb/ui-dialog';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type React from 'react';
import { memo, useEffect, useMemo, useState } from 'react';
import type { DialogActionInFlight } from '../types.js';
import { PluginDialogFooter, type PluginDialogFooterProps } from './PluginDialogFooter.js';
import { PluginDialogHeader } from './PluginDialogHeader.js';

export const createHeaderComponent = (
  title: string,
  subtitle: string | undefined,
  icon: React.ReactNode | undefined,
  pendingAction: DialogActionInFlight | null
) =>
  memo(() => (
    <PluginDialogHeader
      title={title}
      subtitle={subtitle}
      icon={icon || undefined}
      pendingAction={pendingAction}
    />
  ));

export const createContentComponent = (dialogRef: React.RefObject<HTMLElement | null>) =>
  memo(function DialogContentWrapper(props: React.PropsWithChildren) {
    const ctx = useDialogContext<Record<string, unknown>>();
    const isDev = useMemo(() => {
      try {
        return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
      } catch {
        return false;
      }
    }, []);
    const [memoryRemainRatio, setMemoryRemainRatio] = useState<number | null>(null);
    useEffect(() => {
      if (!isDev) return undefined;
      const perf = globalThis.performance as Performance & {
        memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
      };
      if (!perf?.memory) return undefined;
      const update = (): void => {
        const used = perf.memory?.usedJSHeapSize;
        const limit = perf.memory?.jsHeapSizeLimit;
        if (typeof used !== 'number' || typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
          setMemoryRemainRatio(null);
          return;
        }
        const remains = Math.max(0, limit - used);
        setMemoryRemainRatio(Math.min(1, Math.max(0, remains / limit)));
      };
      update();
      const id = window.setInterval(update, 1000);
      return () => window.clearInterval(id);
    }, [isDev]);
    const disablePadding = Boolean(ctx.frameless && ctx.transparent)
      || Boolean(ctx.removePaddingWithFullScreenMode && ctx.displayMode === 'full-screen');
    return (
      <Box
        sx={(theme: Theme) => ({
          flex: 1,
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          padding: disablePadding ? 0 : theme.spacing(2),
        })}
        ref={dialogRef}
      >
        {isDev && memoryRemainRatio !== null ? (
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              backgroundColor: 'background.paper',
              margin: 0,
              padding: 0,
            }}
          >
            <LinearProgress
              variant="determinate"
              value={memoryRemainRatio * 100}
              color={memoryRemainRatio < 0.1 ? 'error' : (memoryRemainRatio < 0.2 ? 'warning' : 'primary')}
              sx={{ margin: 0, padding: 0 }}
            />
          </Box>
        ) : null}
        {props.children}
      </Box>
    );
  });

export const createFooterComponent = (
  footerPropsRef: React.MutableRefObject<PluginDialogFooterProps>
) =>
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
