import { forwardRef, useMemo } from 'react';
import Select, { type SelectProps } from '@mui/material/Select';
import type { SxProps, Theme } from '@mui/material/styles';

export type ModalSelectProps<T = unknown> = SelectProps<T> & {
  /**
   * Additional offset from the modal z-index to ensure the menu renders above dialog surfaces.
   * Defaults to 1000 (modal + 1000) to decisively outrank backdrop/blur overlays.
   */
  menuZIndexOffset?: number;
  /**
   * Container for the menu portal. Must point to the dialog/modal root element.
   * If omitted, the menu renders inline (no portal/body fallback).
   */
  menuContainer?: Element | null;
  /**
   * Render menu in a portal (default: true). Use false when you need to keep the menu within
   * the dialog stacking context to avoid backdrop/blur issues.
   */
  usePortal?: boolean;
};

export const ModalSelect = forwardRef<HTMLDivElement, ModalSelectProps<any>>(function ModalSelect(
  { MenuProps, menuZIndexOffset = 1000, menuContainer, usePortal = true, ...rest },
  ref,
) {
  const mergedMenuProps = useMemo<Partial<SelectProps['MenuProps']>>(() => {
    // Always portal to escape overflow/stacking; use provided container if set, otherwise body.
    const disablePortal = MenuProps?.disablePortal ?? !usePortal;
    const resolvedContainer = MenuProps?.container ?? menuContainer;

    const baseZIndex = (theme?: Theme) => (theme?.zIndex?.modal ?? 1300) + menuZIndexOffset;
    const incomingPaperSx = MenuProps?.PaperProps?.sx;
    const mergedPaperSx: SxProps<Theme> = incomingPaperSx
      ? Array.isArray(incomingPaperSx)
        ? [...incomingPaperSx, (theme) => ({ zIndex: baseZIndex(theme) })]
        : [
            incomingPaperSx,
            (theme) => ({
              zIndex: baseZIndex(theme),
            }),
          ]
      : (theme) => ({ zIndex: baseZIndex(theme) });

    return {
       disablePortal,
      container: disablePortal ? undefined : resolvedContainer,
      PaperProps: {
        ...MenuProps?.PaperProps,
        sx: mergedPaperSx,
      },
      // Also set style on the popover root to avoid being overridden.
      style: {
        ...MenuProps?.style,
        zIndex: baseZIndex(),
      },
      ...MenuProps,
    };
  }, [MenuProps, menuContainer, menuZIndexOffset, usePortal]);

  return <Select ref={ref} MenuProps={mergedMenuProps} {...rest} />;
});
