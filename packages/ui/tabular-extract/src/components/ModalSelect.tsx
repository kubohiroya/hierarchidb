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
   * Render menu in a portal (default: false). Use true only when you need to escape overflow clipping.
   * Inline rendering keeps the menu within the dialog's stacking context to avoid backdrop blur issues.
   */
  usePortal?: boolean;
};

export const ModalSelect = forwardRef<HTMLDivElement, ModalSelectProps<any>>(function ModalSelect(
  { MenuProps, menuZIndexOffset = 1000, menuContainer, usePortal = true, ...rest },
  ref,
) {
  const mergedMenuProps = useMemo<Partial<SelectProps['MenuProps']>>(() => {
    const shouldUsePortal = Boolean(menuContainer) && usePortal;
    const baseSx: SxProps<Theme> = (theme) => ({
      zIndex: (theme?.zIndex?.modal ?? 1300) + menuZIndexOffset,
    });

    const incomingPaperSx = MenuProps?.PaperProps?.sx;
    const mergedPaperSx = incomingPaperSx
      ? Array.isArray(incomingPaperSx)
        ? [baseSx, ...incomingPaperSx]
        : [baseSx, incomingPaperSx]
      : baseSx;

    return {
      disablePortal: !shouldUsePortal,
      container: shouldUsePortal ? menuContainer ?? undefined : undefined,
      ...MenuProps,
      PaperProps: {
        ...MenuProps?.PaperProps,
        sx: mergedPaperSx,
      },
    };
  }, [MenuProps, menuContainer, menuZIndexOffset, usePortal]);

  return <Select ref={ref} MenuProps={mergedMenuProps} {...rest} />;
});
