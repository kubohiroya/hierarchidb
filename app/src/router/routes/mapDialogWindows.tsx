/**
 * @file mapDialogWindows.tsx
 * @description Modeless dialog windows and layout manager for the map page.
 */

import type { ResourceGeoJsonLayer, ResourceVectorLayer } from '@hierarchidb/ui-plugin-shell/ui-map';
import type {
  HeadlessDialogProps,
  HeadlessDialogHeaderProps,
  StepComponentDescriptor,
} from '@hierarchidb/ui-dialog';
import { ModelessDialogFrame, getViewportSize } from '@hierarchidb/ui-dialog';
import { PluginDialogHeader } from '@hierarchidb/plugin-ui-host';
import { Box, Button, Stack } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapInfoContent, MapLayerContent } from './mapDialogContent.js';
import {
  STORAGE_KEY_PREFIX,
  applyDisplayMode,
  loadLayout,
  mergeLayout,
  persistLayout,
  type MapDialogLayout,
  type MapDialogDefinitionBase,
  type MapDialogWindowState,
} from './mapDialogLayout.js';

const BASE_Z_INDEX_OFFSET = 100;
const MINIMIZED_HEIGHT = 56;

export type MapDialogLayerInput = {
  nodeId: string;
  formattedZxy: string;
  basemapStyles: Array<{ nodeId: string; absolutePath?: string }>;
  vectorLayers: ResourceVectorLayer[];
  geoJsonLayers: ResourceGeoJsonLayer[];
};

type MapDialogDefinition = MapDialogDefinitionBase & {
  title: string;
  subtitle?: string;
  content: React.ReactNode;
};

const EmptyFooter: React.FC = () => null;

function createHeaderComponent(title: string, subtitle?: string) {
  const Header: React.FC<HeadlessDialogHeaderProps<Record<string, unknown>>> = () => (
    <PluginDialogHeader title={title} subtitle={subtitle} />
  );
  Header.displayName = `MapDialogHeader(${title})`;
  return Header;
}

function createContentComponent(content: React.ReactNode) {
  const Content: React.FC = () => (
    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>{content}</Box>
  );
  Content.displayName = 'MapDialogContent';
  return Content;
}

function createStepComponents(id: string, title: string): StepComponentDescriptor<Record<string, unknown>>[] {
  const StepComponent: React.FC = () => null;
  StepComponent.displayName = `MapDialogStep(${id})`;
  return [
    {
      id,
      label: title,
      component: StepComponent,
    },
  ];
}

type MapDialogWindowProps = {
  definition: MapDialogDefinition;
  windowState: MapDialogWindowState;
  zIndex: number;
  onUpdate: (id: string, patch: Partial<MapDialogWindowState>) => void;
  onDisplayModeChange: (id: string, mode: MapDialogWindowState['displayMode']) => void;
  onRequestFocus: (id: string) => void;
};

const MapDialogWindow: React.FC<MapDialogWindowProps> = ({
  definition,
  windowState,
  zIndex,
  onUpdate,
  onDisplayModeChange,
  onRequestFocus,
}) => {
  const headerComponent = useMemo(
    () => createHeaderComponent(definition.title, definition.subtitle),
    [definition.subtitle, definition.title],
  );
  const contentComponent = useMemo(
    () => createContentComponent(definition.content),
    [definition.content],
  );
  const stepComponents = useMemo(
    () => createStepComponents(definition.id, definition.title),
    [definition.id, definition.title],
  );

  const headlessProps: HeadlessDialogProps<Record<string, unknown>> = {
    open: windowState.isVisible,
    stepComponents,
    stepData: {},
    onStepDataChange: () => undefined,
    activeStepIndex: 0,
    onStepNavigate: () => undefined,
    onRequestClose: () => {
      onUpdate(definition.id, { isVisible: false });
    },
    HeaderComponent: headerComponent,
    ContentComponent: contentComponent,
    FooterComponent: EmptyFooter,
    position: windowState.position,
    onPositionChange: (next) => onUpdate(definition.id, { position: next }),
    size: windowState.size,
    onSizeChange: (next) => onUpdate(definition.id, { size: next }),
    displayMode: windowState.displayMode,
    onDisplayModeChange: (nextMode) => onDisplayModeChange(definition.id, nextMode),
    isMinimized: windowState.isMinimized,
    onMinimizeChange: (next) => onUpdate(definition.id, { isMinimized: next }),
  };

  return (
    <ModelessDialogFrame
      headlessProps={headlessProps}
      zIndex={zIndex}
      onRequestFocus={() => onRequestFocus(definition.id)}
      disablePortal
      minimizedHeight={MINIMIZED_HEIGHT}
    />
  );
};

export const MapDialogWindows: React.FC<MapDialogLayerInput> = ({
  nodeId,
  formattedZxy,
  basemapStyles,
  vectorLayers,
  geoJsonLayers,
}) => {
  const theme = useTheme();

  const definitions = useMemo<MapDialogDefinition[]>(() => [
    {
      id: 'map-info',
      title: 'Map Info',
      defaultSize: { width: 320, height: 180 },
      content: <MapInfoContent formattedZxy={formattedZxy} />,
    },
    {
      id: 'map-layers',
      title: 'Layers',
      defaultSize: { width: 360, height: 360 },
      content: (
        <MapLayerContent
          basemapStyles={basemapStyles}
          vectorLayers={vectorLayers}
          geoJsonLayers={geoJsonLayers}
        />
      ),
    },
  ], [basemapStyles, formattedZxy, geoJsonLayers, vectorLayers]);

  const storageKey = useMemo(() => `${STORAGE_KEY_PREFIX}.${nodeId}`, [nodeId]);

  const [layout, setLayout] = useState<MapDialogLayout>(() => loadLayout(storageKey, definitions));

  useEffect(() => {
    setLayout(loadLayout(storageKey, definitions));
  }, [storageKey]);

  useEffect(() => {
    setLayout((prev) => mergeLayout(prev, definitions));
  }, [definitions]);

  useEffect(() => {
    persistLayout(storageKey, layout);
  }, [layout, storageKey]);

  const updateWindow = useCallback((id: string, patch: Partial<MapDialogWindowState>) => {
    setLayout((prev) => {
      const target = prev.windows[id];
      if (!target) return prev;
      const next: MapDialogWindowState = { ...target, ...patch };
      if (target.displayMode === 'normal') {
        if (patch.position) next.lastNormalPosition = patch.position;
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

  const changeDisplayMode = useCallback((id: string, mode: MapDialogWindowState['displayMode']) => {
    setLayout((prev) => {
      const target = prev.windows[id];
      if (!target) return prev;
      const viewport = getViewportSize();
      const updated = applyDisplayMode(target, mode, viewport);
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
    updateWindow(id, { isVisible: nextVisible });
    if (nextVisible) {
      bringToFront(id);
    }
  }, [bringToFront, updateWindow]);

  const baseZIndex = (theme.zIndex?.modal ?? 1300) - BASE_Z_INDEX_OFFSET;

  return (
    <>
      {definitions.map((definition) => {
        const windowState = layout.windows[definition.id];
        if (!windowState) return null;
        const orderIndex = layout.order.indexOf(definition.id);
        const zIndex = baseZIndex + (orderIndex >= 0 ? orderIndex + 1 : 1);
        return (
          <MapDialogWindow
            key={definition.id}
            definition={definition}
            windowState={windowState}
            zIndex={zIndex}
            onUpdate={updateWindow}
            onDisplayModeChange={changeDisplayMode}
            onRequestFocus={bringToFront}
          />
        );
      })}

      <Box
        sx={{
          position: 'absolute',
          right: 16,
          bottom: 16,
          zIndex: baseZIndex + definitions.length + 10,
          pointerEvents: 'auto',
        }}
      >
        <Stack spacing={1} alignItems="flex-end">
          {definitions.map((definition) => {
            const windowState = layout.windows[definition.id];
            const isVisible = windowState?.isVisible ?? true;
            return (
              <Button
                key={definition.id}
                size="small"
                variant={isVisible ? 'contained' : 'outlined'}
                onClick={() => toggleWindowVisibility(definition.id, !isVisible)}
              >
                {isVisible ? `Hide ${definition.title}` : `Show ${definition.title}`}
              </Button>
            );
          })}
        </Stack>
      </Box>
    </>
  );
};
