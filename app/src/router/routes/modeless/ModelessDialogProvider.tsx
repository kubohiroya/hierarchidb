/**
 * @file ModelessDialogProvider.tsx
 * @description Context provider for modeless dialog atoms and configuration.
 */

import type { DialogDisplayMode, DialogPosition } from '@hierarchidb/tree-api';
import type { SxProps, Theme } from '@mui/material/styles';
import type { TooltipProps } from '@mui/material/Tooltip';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyDisplayMode,
  loadLayout,
  type MapDialogDefinitionBase,
  type MapDialogLayout,
  type MapDialogWindowState,
  type ModelessIconPlacement,
  mergeLayout,
  persistLayout,
  resolveRestorePosition,
} from './modelessDialogLayout.js';

export type { ModelessIconPlacement } from './modelessDialogLayout.js';

export type ModelessIconAppearance = {
  buttonSx?: SxProps<Theme>;
  buttonSize?: 'small' | 'medium' | 'large';
  tooltipPlacement?: TooltipProps['placement'];
};

export type ModelessDialogConfig = {
  iconPlacement: ModelessIconPlacement;
  iconAppearance?: ModelessIconAppearance;
};

type ModelessDialogContextValue = {
  config: ModelessDialogConfig;
  layout: MapDialogLayout;
  definitions: MapDialogDefinitionBase[];
  updateWindow: (id: string, patch: Partial<MapDialogWindowState>) => void;
  bringToFront: (id: string) => void;
  changeDisplayMode: (id: string, mode: DialogDisplayMode) => void;
  toggleWindowVisibility: (id: string, nextVisible: boolean) => void;
};

const ModelessDialogContext = createContext<ModelessDialogContextValue | null>(null);

export type ModelessDialogProviderProps = {
  storageKey: string;
  definitions: MapDialogDefinitionBase[];
  iconPlacement?: ModelessIconPlacement;
  iconAppearance?: ModelessIconAppearance;
  children: React.ReactNode;
};

const defaultIconPlacement: ModelessIconPlacement = {
  anchor: 'bottom-right',
  offset: { x: 16, y: 16 },
  spacing: 12,
};

export const ModelessDialogProvider: React.FC<ModelessDialogProviderProps> = ({
  storageKey,
  definitions,
  iconPlacement,
  iconAppearance,
  children,
}) => {
  const resolvedPlacement = iconPlacement ?? defaultIconPlacement;
  const config = useMemo<ModelessDialogConfig>(
    () => ({
      iconPlacement: resolvedPlacement,
      iconAppearance,
    }),
    [iconAppearance, resolvedPlacement]
  );

  const [layout, setLayout] = useState<MapDialogLayout>(() =>
    loadLayout(storageKey, definitions, resolvedPlacement)
  );

  useEffect(() => {
    setLayout(loadLayout(storageKey, definitions, resolvedPlacement));
  }, [definitions, resolvedPlacement, storageKey]);

  useEffect(() => {
    setLayout((prev) => mergeLayout(prev, definitions, resolvedPlacement));
  }, [definitions, resolvedPlacement]);

  useEffect(() => {
    persistLayout(storageKey, layout);
  }, [layout, storageKey]);

  const updateWindow = useCallback((id: string, patch: Partial<MapDialogWindowState>) => {
    setLayout((prev) => {
      const target = prev.windows[id];
      if (!target) return prev;
      const next: MapDialogWindowState = { ...target, ...patch };
      if (target.displayMode === 'normal') {
        if (patch.position) next.lastNormalPosition = patch.position as DialogPosition;
        if (patch.size) next.lastNormalSize = patch.size;
      }
      return {
        ...prev,
        windows: {
          ...prev.windows,
          [id]: next,
        },
      };
    });
  }, []);

  const bringToFront = useCallback((id: string) => {
    setLayout((prev) => {
      if (!prev.order.includes(id)) return prev;
      const nextOrder = prev.order.filter((entry) => entry !== id);
      nextOrder.push(id);
      return { ...prev, order: nextOrder };
    });
  }, []);

  const changeDisplayMode = useCallback((id: string, mode: DialogDisplayMode) => {
    setLayout((prev) => {
      const target = prev.windows[id];
      if (!target) return prev;
      const updated = applyDisplayMode(target, mode);
      return {
        ...prev,
        windows: {
          ...prev.windows,
          [id]: updated,
        },
      };
    });
  }, []);

  const toggleWindowVisibility = useCallback((id: string, nextVisible: boolean) => {
    setLayout((prev) => {
      const target = prev.windows[id];
      if (!target) return prev;
      let nextWindow: MapDialogWindowState = { ...target, isVisible: nextVisible };
      if (nextVisible && !target.isVisible) {
        const restoredPosition = resolveRestorePosition({
          layout: prev,
          windowId: id,
          windowState: target,
        });
        nextWindow = { ...nextWindow, position: restoredPosition };
        if (nextWindow.displayMode === 'normal') {
          nextWindow.lastNormalPosition = restoredPosition;
        }
      }

      const nextOrder = nextVisible
        ? [...prev.order.filter((entry) => entry !== id), id]
        : prev.order;

      return {
        ...prev,
        windows: {
          ...prev.windows,
          [id]: nextWindow,
        },
        order: nextOrder,
      };
    });
  }, []);

  const value = useMemo<ModelessDialogContextValue>(
    () => ({
      config,
      layout,
      definitions,
      updateWindow,
      bringToFront,
      changeDisplayMode,
      toggleWindowVisibility,
    }),
    [
      bringToFront,
      changeDisplayMode,
      config,
      definitions,
      layout,
      toggleWindowVisibility,
      updateWindow,
    ]
  );

  return <ModelessDialogContext.Provider value={value}>{children}</ModelessDialogContext.Provider>;
};

export const useModelessDialogContext = () => {
  const ctx = useContext(ModelessDialogContext);
  if (!ctx) {
    throw new Error('useModelessDialogContext must be used within ModelessDialogProvider');
  }
  return ctx;
};
