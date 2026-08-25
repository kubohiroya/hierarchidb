import { ROUTE_MODES, type RouteBuildRouteInput } from '@hierarchidb/route-api';
import { describe, expect, it } from 'vitest';
import { materializeSourcePlannedRouteGenerationMethod } from './RouteBuildManager.js';

describe('materializeSourcePlannedRouteGenerationMethod', () => {
  it('materializes airway routes as great-circle generation', () => {
    expect(materializeMethod(ROUTE_MODES.AIRWAY)).toBe('great_circle');
  });

  it('materializes waterway routes as searoute generation', () => {
    expect(materializeMethod(ROUTE_MODES.WATERWAY)).toBe('searoute');
  });

  it('materializes land routes from the configured direct default', () => {
    expect(materializeMethod(ROUTE_MODES.RAILWAY)).toBe('direct');
    expect(materializeMethod(ROUTE_MODES.H_RAILWAY)).toBe('direct');
    expect(materializeMethod(ROUTE_MODES.ROAD)).toBe('direct');
    expect(materializeMethod(ROUTE_MODES.HIGHWAY)).toBe('direct');
  });

  it('uses the configured node method for land routes', () => {
    expect(materializeMethod(ROUTE_MODES.ROAD, undefined, 'osm_route')).toBe('osm_route');
    expect(materializeMethod(ROUTE_MODES.RAILWAY, undefined, 'custom')).toBe('custom');
  });

  it('keeps compatible explicit route input methods authoritative', () => {
    expect(materializeMethod(ROUTE_MODES.ROAD, 'osm_route', 'direct')).toBe('osm_route');
    expect(materializeMethod(ROUTE_MODES.RAILWAY, 'custom', 'direct')).toBe('custom');
  });

  it('rejects explicit methods that violate fixed airway and waterway strategies', () => {
    expect(() => materializeMethod(ROUTE_MODES.AIRWAY, 'direct')).toThrow(
      'routeMode airway requires generation method great_circle'
    );
    expect(() => materializeMethod(ROUTE_MODES.WATERWAY, 'great_circle')).toThrow(
      'routeMode waterway requires generation method searoute'
    );
  });

  it('rejects configured land methods outside direct or network routing', () => {
    expect(() => materializeMethod(ROUTE_MODES.ROAD, undefined, 'searoute')).toThrow(
      'routeMode road does not support generation method searoute'
    );
    expect(() => materializeMethod(ROUTE_MODES.RAILWAY, undefined, 'great_circle')).toThrow(
      'routeMode railway does not support generation method great_circle'
    );
  });
});

const materializeMethod = (
  routeMode: RouteBuildRouteInput['routeMode'],
  method?: RouteBuildRouteInput['method'],
  configuredMethod: RouteBuildRouteInput['method'] = 'direct'
) =>
  materializeSourcePlannedRouteGenerationMethod(
    {
      routeMode,
      ...(method === undefined ? {} : { method }),
    },
    configuredMethod
  );
