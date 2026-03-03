import type { SvgIconComponent } from '@mui/icons-material';
import { DirectionsBoat, DirectionsCar, Flight, Train, Tram } from '@mui/icons-material';
import { ROUTE_MODES, type RouteMode } from '@hierarchidb/route-api';

type SelectionColumn = {
  id: RouteMode;
  labelKey: string;
  icon: SvgIconComponent;
};

export const ROUTE_MODE_COLUMNS: SelectionColumn[] = [
  { id: ROUTE_MODES.AIRWAY, labelKey: 'transportModes.air', icon: Flight },
  { id: ROUTE_MODES.WATERWAY, labelKey: 'transportModes.sea', icon: DirectionsBoat },
  { id: ROUTE_MODES.H_RAILWAY, labelKey: 'transportModes.highSpeedRail', icon: Train },
  { id: ROUTE_MODES.RAILWAY, labelKey: 'transportModes.rail', icon: Tram },
  { id: ROUTE_MODES.ROAD, labelKey: 'transportModes.road', icon: DirectionsCar },
];

export type RouteSelectionCondition = 'or' | 'and';
export type RouteSelectionColumnId = `${RouteSelectionCondition}:${RouteMode}`;

type RouteSelectionColumn = {
  id: RouteSelectionColumnId;
  mode: RouteMode;
  condition: RouteSelectionCondition;
  labelKey: string;
  icon: SvgIconComponent;
};

export const buildRouteSelectionColumnId = (
  condition: RouteSelectionCondition,
  mode: RouteMode
): RouteSelectionColumnId => `${condition}:${mode}` as RouteSelectionColumnId;

export const parseRouteSelectionColumnId = (
  id: string
): { condition: RouteSelectionCondition; mode: RouteMode } | null => {
  const [condition, mode] = id.split(':');
  if ((condition !== 'or' && condition !== 'and') || !mode) return null;
  if (!ROUTE_MODE_COLUMNS.some((column) => column.id === mode)) return null;
  return { condition, mode: mode as RouteMode };
};

export const ROUTE_SELECTION_COLUMNS: RouteSelectionColumn[] = [
  ...ROUTE_MODE_COLUMNS.map((column) => ({
    id: buildRouteSelectionColumnId('or', column.id),
    condition: 'or' as const,
    mode: column.id,
    labelKey: column.labelKey,
    icon: column.icon,
  })),
  ...ROUTE_MODE_COLUMNS.map((column) => ({
    id: buildRouteSelectionColumnId('and', column.id),
    condition: 'and' as const,
    mode: column.id,
    labelKey: column.labelKey,
    icon: column.icon,
  })),
];

export const ROUTE_STYLE_OPTIONS = [
  { id: 'solid', labelKey: 'routeConfig.style.lineStyle.solid', fallback: 'Solid' },
  { id: 'dashed', labelKey: 'routeConfig.style.lineStyle.dashed', fallback: 'Dashed' },
  { id: 'dotted', labelKey: 'routeConfig.style.lineStyle.dotted', fallback: 'Dotted' },
] as const;

export const LINE_WIDTH_MIN = 1;
export const LINE_WIDTH_MAX = 8;
