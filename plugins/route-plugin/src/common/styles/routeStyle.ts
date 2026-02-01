import { ROUTE_MODES, type RouteLineStyle, type RouteMode, type RouteStyleConfig } from '@hierarchidb/route-api';

export const DEFAULT_ROUTE_MODE_COLORS: Record<RouteMode, string> = {
  [ROUTE_MODES.AIRWAY]: '#1f77b4',
  [ROUTE_MODES.WATERWAY]: '#17becf',
  [ROUTE_MODES.H_RAILWAY]: '#d62728',
  [ROUTE_MODES.RAILWAY]: '#ff7f0e',
  [ROUTE_MODES.ROAD]: '#2ca02c',
  [ROUTE_MODES.HIGHWAY]: '#9467bd',
};

export const DEFAULT_ROUTE_LINE_WIDTH = 2;
export const DEFAULT_ROUTE_LINE_STYLE: RouteLineStyle = 'solid';

export const buildDefaultRouteStyleConfig = (): RouteStyleConfig => ({
  modeColors: { ...DEFAULT_ROUTE_MODE_COLORS },
  lineWidth: DEFAULT_ROUTE_LINE_WIDTH,
  lineStyle: DEFAULT_ROUTE_LINE_STYLE,
});

export const mergeRouteStyleConfig = (
  overrides?: Partial<RouteStyleConfig>
): RouteStyleConfig => {
  const base = buildDefaultRouteStyleConfig();
  if (!overrides) return base;
  return {
    modeColors: { ...base.modeColors, ...(overrides.modeColors ?? {}) },
    lineWidth: typeof overrides.lineWidth === 'number' ? overrides.lineWidth : base.lineWidth,
    lineStyle: overrides.lineStyle ?? base.lineStyle,
  };
};

export const buildRouteColorExpression = (config: RouteStyleConfig): unknown => ([
  'match',
  ['get', 'routeMode'],
  ROUTE_MODES.AIRWAY,
  config.modeColors[ROUTE_MODES.AIRWAY],
  ROUTE_MODES.WATERWAY,
  config.modeColors[ROUTE_MODES.WATERWAY],
  ROUTE_MODES.H_RAILWAY,
  config.modeColors[ROUTE_MODES.H_RAILWAY],
  ROUTE_MODES.RAILWAY,
  config.modeColors[ROUTE_MODES.RAILWAY],
  ROUTE_MODES.HIGHWAY,
  config.modeColors[ROUTE_MODES.HIGHWAY],
  ROUTE_MODES.ROAD,
  config.modeColors[ROUTE_MODES.ROAD],
  config.modeColors[ROUTE_MODES.ROAD],
]);

export const resolveLineDashArray = (style: RouteLineStyle): number[] | undefined => {
  switch (style) {
    case 'dashed':
      return [2, 2];
    case 'dotted':
      return [1, 1];
    default:
      return undefined;
  }
};
