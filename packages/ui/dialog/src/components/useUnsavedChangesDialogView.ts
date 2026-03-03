import { useMemo } from 'react';
import type { DialogProps } from '@mui/material';

export interface UseUnsavedChangesDialogViewParams {
  container?: DialogProps['container'];
  slotProps?: DialogProps['slotProps'];
}

export interface UseUnsavedChangesDialogViewResult {
  resolvedContainer: DialogProps['container'];
  resolvedSlotProps: DialogProps['slotProps'];
}

export function useUnsavedChangesDialogView({
  container,
  slotProps,
}: UseUnsavedChangesDialogViewParams): UseUnsavedChangesDialogViewResult {
  const defaultContainer = useMemo<DialogProps['container']>(() => {
    if (typeof document === 'undefined') return undefined;
    return document.body;
  }, []);

  const resolvedSlotProps: DialogProps['slotProps'] = useMemo(() => {
    if (slotProps) return slotProps;
    return {
      backdrop: {
        sx: {
          zIndex: (theme) => (theme?.zIndex?.modal ?? 1300) + 5000,
        },
      },
      paper: {
        sx: {
          zIndex: (theme) => (theme?.zIndex?.modal ?? 1300) + 5001,
        },
      },
    };
  }, [slotProps]);

  return {
    resolvedContainer: container ?? defaultContainer,
    resolvedSlotProps,
  };
}
