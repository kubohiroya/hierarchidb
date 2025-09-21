import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { HeadlessMultiStepDialog } from '@hierarchidb/ui-dialog';
import type { PluginDialogControllerOptions } from './usePluginDialogController.js';
import { usePluginDialogController } from './usePluginDialogController.js';

export type PluginDialogShellProps = PluginDialogControllerOptions;

export const PluginDialogShell: React.FC<PluginDialogShellProps> = (props) => {
  const { headlessProps } = usePluginDialogController(props);
  const isBrowser = typeof document !== 'undefined';

  useEffect(() => {
    if (!isBrowser) return;
    if (!headlessProps.open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [headlessProps.open, isBrowser]);

  const { size, displayMode } = headlessProps;
  const baseWidth = size?.width ?? 960;
  const baseHeight = size?.height ?? 640;
  const fullScreen = displayMode === 'full-screen';
  const widthPx = `${baseWidth}px`;
  const heightPx = `${baseHeight}px`;

  const dialogNode = useMemo(() => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483600,
        display: 'flex',
        alignItems: fullScreen ? 'stretch' : 'center',
        justifyContent: fullScreen ? 'stretch' : 'center',
        padding: fullScreen ? 0 : '24px',
        backgroundColor: 'rgba(9, 12, 28, 0.45)',
        pointerEvents: headlessProps.open ? 'auto' : 'none',
      }}
      role="presentation"
    >
      <div
        style={{
          width: fullScreen ? '100%' : widthPx,
          maxWidth: fullScreen ? '100%' : 'calc(100vw - 48px)',
          height: fullScreen ? '100%' : heightPx,
          maxHeight: fullScreen ? '100%' : 'calc(100vh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: fullScreen ? 0 : 12,
          boxShadow: '0 22px 80px rgba(10, 14, 36, 0.38)',
          overflow: 'hidden',
          backgroundColor: '#fff',
        }}
        role="dialog"
        aria-modal="true"
      >
        <HeadlessMultiStepDialog {...headlessProps} />
      </div>
    </div>
  ), [fullScreen, headlessProps, heightPx, widthPx]);

  if (!headlessProps.open) {
    return null;
  }

  if (!isBrowser) {
    return dialogNode;
  }

  return createPortal(dialogNode, document.body);
};

PluginDialogShell.displayName = 'PluginDialogShell';
