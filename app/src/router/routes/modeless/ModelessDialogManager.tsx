/**
 * @file ModelessDialogManager.tsx
 * @description Modeless dialog manager with stacking and restore icons for the map page.
 */

import type { NodeId } from '@hierarchidb/common-types';
import { PluginDialogHeader } from '@hierarchidb/plugin-ui-host';
import type {
  HeadlessDialogHeaderProps,
  HeadlessDialogProps,
  StepComponentDescriptor,
} from '@hierarchidb/ui-dialog';
import { ModelessDialogFrame } from '@hierarchidb/ui-dialog';
import type {
  LayerSetDefinition,
  LayerSetId,
  LayerSetVisibility,
  MapToggleOption,
  MapToggleSelection,
  ResourceGeoJsonLayer,
  ResourceVectorLayer,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import { MapToggleCard } from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  AltRoute as AltRouteIcon,
  Brush as BrushIcon,
  InfoOutlined as InfoOutlinedIcon,
  Layers as LayersIcon,
  PlaceOutlined as PlaceOutlinedIcon,
  TableView as TableViewIcon,
} from '@mui/icons-material';
import { Box, IconButton, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type React from 'react';
import { useCallback, useMemo, useRef } from 'react';
import type { MapStylerSummary } from '../map/types.js';
import type { ModelessIconAppearance, ModelessIconPlacement } from './ModelessDialogProvider.js';
import { ModelessDialogProvider, useModelessDialogContext } from './ModelessDialogProvider.js';
import {
  MapGeneratedDataContent,
  MapInfoContent,
  type MapInfoSummary,
  MapLayerContent,
  MapStylerContent,
} from './modelessDialogContent.js';
import type { MapDialogDefinitionBase, MapDialogWindowState } from './modelessDialogLayout.js';

const BASE_Z_INDEX_OFFSET = 100;
const MINIMIZED_HEIGHT = 56;

export type MapDialogLayerInput = {
  nodeId: string;
  formattedZxy: string;
  basemapStyles: Array<{ nodeId: string; absolutePath?: string }>;
  vectorLayers: ResourceVectorLayer[];
  geoJsonLayers: ResourceGeoJsonLayer[];
  mapInfo: MapInfoSummary;
  stylerSummaries: MapStylerSummary[];
  stylerToggles: Record<string, boolean>;
  onToggleStyler: (stylerId: string, enabled: boolean) => void;
  locationTypeOptions: MapToggleOption[];
  routeModeOptions: MapToggleOption[];
  locationTypeSelection: MapToggleSelection;
  routeModeSelection: MapToggleSelection;
  onToggleLocationType: (id: string) => void;
  onToggleRouteMode: (id: string) => void;
  layerSets: LayerSetDefinition[];
  layerSetVisibility: LayerSetVisibility;
  onToggleLayerSet: (id: LayerSetId) => void;
};

type MapDialogDefinition = MapDialogDefinitionBase & {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  contentPadding?: number;
  frameless?: boolean;
  transparent?: boolean;
};

const EmptyFooter: React.FC = () => null;

function createHeaderComponent(title: string, subtitle: string | undefined, icon: React.ReactNode) {
  const Header: React.FC<HeadlessDialogHeaderProps<Record<string, unknown>>> = () => (
    <PluginDialogHeader title={title} subtitle={subtitle} icon={icon} />
  );
  Header.displayName = `MapDialogHeader(${title})`;
  return Header;
}

function createContentComponent(content: React.ReactNode, padding = 2) {
  const Content: React.FC = () => (
    <Box sx={{ flex: 1, overflow: 'auto', p: padding }}>{content}</Box>
  );
  Content.displayName = 'MapDialogContent';
  return Content;
}

function createStepComponents(
  id: string,
  title: string
): StepComponentDescriptor<Record<string, unknown>>[] {
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
    () => createHeaderComponent(definition.title, definition.subtitle, definition.icon),
    [definition.icon, definition.subtitle, definition.title]
  );
  const contentComponent = useMemo(
    () => createContentComponent(definition.content, definition.contentPadding),
    [definition.content, definition.contentPadding]
  );
  const stepComponents = useMemo(
    () => createStepComponents(definition.id, definition.title),
    [definition.id, definition.title]
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
      frameless={definition.frameless}
      transparent={definition.transparent}
    />
  );
};

type ClosedDialogIconProps = {
  windowState: MapDialogWindowState;
  title: string;
  icon: React.ReactNode;
  zIndex: number;
  onRestore: () => void;
  onPositionChange: (next: MapDialogWindowState['position']) => void;
  buttonSx?: ModelessIconAppearance['buttonSx'];
  buttonSize?: ModelessIconAppearance['buttonSize'];
  tooltipPlacement?: ModelessIconAppearance['tooltipPlacement'];
};

const ClosedDialogIcon: React.FC<ClosedDialogIconProps> = ({
  windowState,
  title,
  icon,
  zIndex,
  onRestore,
  onPositionChange,
  buttonSx,
  buttonSize,
  tooltipPlacement,
}) => {
  const dragStateRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    start: { x: number; y: number };
  } | null>(null);
  const movedRef = useRef(false);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      movedRef.current = false;
      dragStateRef.current = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        start: windowState.iconPosition ?? windowState.position,
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const state = dragStateRef.current;
        if (!state || moveEvent.pointerId !== state.pointerId) return;
        if (
          Math.abs(moveEvent.clientX - state.originX) > 2 ||
          Math.abs(moveEvent.clientY - state.originY) > 2
        ) {
          movedRef.current = true;
        }
        const next = {
          x: state.start.x + (moveEvent.clientX - state.originX),
          y: state.start.y + (moveEvent.clientY - state.originY),
        };
        onPositionChange(next);
      };

      const handlePointerEnd = (endEvent: PointerEvent) => {
        if (dragStateRef.current?.pointerId !== endEvent.pointerId) return;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerEnd);
        window.removeEventListener('pointercancel', handlePointerEnd);
        dragStateRef.current = null;
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerEnd);
      window.addEventListener('pointercancel', handlePointerEnd);
    },
    [onPositionChange, windowState.iconPosition, windowState.position]
  );

  const position = windowState.iconPosition ?? windowState.position;

  return (
    <Box
      sx={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex,
        pointerEvents: 'auto',
      }}
    >
      <Tooltip title={title} placement={tooltipPlacement}>
        <IconButton
          color="primary"
          size={buttonSize}
          sx={buttonSx}
          onClick={() => {
            if (movedRef.current) return;
            onRestore();
          }}
          onPointerDown={handlePointerDown}
          onPointerUp={(event) => {
            event.stopPropagation();
          }}
        >
          {icon}
        </IconButton>
      </Tooltip>
    </Box>
  );
};

const ModelessDialogManagerBody: React.FC = () => {
  const theme = useTheme();
  const {
    config,
    layout,
    definitions,
    updateWindow,
    bringToFront,
    changeDisplayMode,
    toggleWindowVisibility,
  } = useModelessDialogContext();
  const dialogDefinitions = definitions as MapDialogDefinition[];
  const baseZIndex = (theme.zIndex?.modal ?? 1300) - BASE_Z_INDEX_OFFSET;
  const iconAppearance = config.iconAppearance;

  return (
    <>
      {dialogDefinitions.map((definition) => {
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

      {dialogDefinitions.map((definition) => {
        const windowState = layout.windows[definition.id];
        if (!windowState || windowState.isVisible) return null;
        const orderIndex = layout.order.indexOf(definition.id);
        const zIndex = baseZIndex + (orderIndex >= 0 ? orderIndex + 1 : 1);
        return (
          <ClosedDialogIcon
            key={`${definition.id}-icon`}
            windowState={windowState}
            title={definition.title}
            icon={definition.icon}
            zIndex={zIndex}
            onRestore={() => toggleWindowVisibility(definition.id, true)}
            onPositionChange={(next) => updateWindow(definition.id, { iconPosition: next })}
            buttonSx={iconAppearance?.buttonSx}
            buttonSize={iconAppearance?.buttonSize}
            tooltipPlacement={iconAppearance?.tooltipPlacement}
          />
        );
      })}
    </>
  );
};

export type ModelessDialogManagerProps = MapDialogLayerInput & {
  iconPlacement?: ModelessIconPlacement;
  iconAppearance?: ModelessIconAppearance;
};

export const ModelessDialogManager: React.FC<ModelessDialogManagerProps> = ({
  nodeId,
  formattedZxy,
  basemapStyles,
  vectorLayers,
  geoJsonLayers,
  mapInfo,
  stylerSummaries,
  stylerToggles,
  onToggleStyler,
  locationTypeOptions,
  routeModeOptions,
  locationTypeSelection,
  routeModeSelection,
  onToggleLocationType,
  onToggleRouteMode,
  layerSets,
  layerSetVisibility,
  onToggleLayerSet,
  iconPlacement,
  iconAppearance,
}) => {
  const definitions = useMemo<MapDialogDefinition[]>(
    () => [
      {
        id: 'map-info',
        title: 'Map Info',
        icon: <InfoOutlinedIcon fontSize="small" />,
        defaultSize: { width: 320, height: 180 },
        content: <MapInfoContent formattedZxy={formattedZxy} info={mapInfo} />,
      },
      {
        id: 'map-layers',
        title: 'Layers',
        icon: <LayersIcon fontSize="small" />,
        defaultSize: { width: 360, height: 360 },
        content: (
          <MapLayerContent
            basemapStyles={basemapStyles}
            vectorLayers={vectorLayers}
            geoJsonLayers={geoJsonLayers}
            layerSets={layerSets}
            layerSetVisibility={layerSetVisibility}
            onToggleLayerSet={onToggleLayerSet}
          />
        ),
      },
      {
        id: 'map-data-table',
        title: 'Data Table',
        icon: <TableViewIcon fontSize="small" />,
        defaultSize: { width: 720, height: 420 },
        content: <MapGeneratedDataContent nodeId={nodeId as NodeId} />,
      },
      {
        id: 'map-style-table',
        title: 'Styles',
        icon: <BrushIcon fontSize="small" />,
        defaultSize: { width: 860, height: 420 },
        content: (
          <MapStylerContent
            stylerSummaries={stylerSummaries}
            stylerToggles={stylerToggles}
            onToggleStyler={onToggleStyler}
          />
        ),
      },
      {
        id: 'map-location-types',
        title: 'Terrain Types',
        icon: <PlaceOutlinedIcon fontSize="small" />,
        defaultSize: { width: 360, height: 220 },
        contentPadding: 0,
        frameless: true,
        transparent: true,
        content: (
          <MapToggleCard
            title="Terrain Types"
            options={locationTypeOptions}
            selection={locationTypeSelection}
            onToggle={onToggleLocationType}
          />
        ),
      },
      {
        id: 'map-route-modes',
        title: 'Route Modes',
        icon: <AltRouteIcon fontSize="small" />,
        defaultSize: { width: 360, height: 220 },
        contentPadding: 0,
        frameless: true,
        transparent: true,
        content: (
          <MapToggleCard
            title="Route Modes"
            options={routeModeOptions}
            selection={routeModeSelection}
            onToggle={onToggleRouteMode}
          />
        ),
      },
    ],
    [basemapStyles, formattedZxy, geoJsonLayers, layerSetVisibility, layerSets, locationTypeOptions, locationTypeSelection, mapInfo, nodeId, onToggleLayerSet, onToggleLocationType, onToggleRouteMode, onToggleStyler, routeModeOptions, routeModeSelection, stylerSummaries, stylerToggles, vectorLayers]
  );

  const storageKey = useMemo(() => `hdb.map.dialogs.${nodeId}`, [nodeId]);

  return (
    <ModelessDialogProvider
      storageKey={storageKey}
      definitions={definitions}
      iconPlacement={iconPlacement}
      iconAppearance={iconAppearance}
    >
      <ModelessDialogManagerBody />
    </ModelessDialogProvider>
  );
};
