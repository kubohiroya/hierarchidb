import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RouteLineString } from '@hierarchidb/route-api';
import { ROUTE_MODES } from '@hierarchidb/route-api';
import type { MapLibreMapInstance } from '@hierarchidb/ui-map';

const listRouteLineStrings = vi.fn(async () => [lineStringFixture]);
const listRouteBuildErrors = vi.fn(async () => []);
const findNearestRouteLine = vi.fn(async () => ({
  cursor: {
    longitude: 139,
    latitude: 35,
  },
  matches: [{
    line: {
      lineStringId: lineStringFixture.id,
      routeName: lineStringFixture.name,
      nearestPoint: [139, 35],
      routeMode: ROUTE_MODES.RAILWAY,
      start: {
        name: lineStringFixture.startPoint.name,
        admin2Name: lineStringFixture.startPoint.admin2Name,
        admin1Name: lineStringFixture.startPoint.admin1Name,
        admin0Name: lineStringFixture.startPoint.admin0Name,
      },
      end: {
        name: lineStringFixture.endPoint.name,
        admin2Name: lineStringFixture.endPoint.admin2Name,
        admin1Name: lineStringFixture.endPoint.admin1Name,
        admin0Name: lineStringFixture.endPoint.admin0Name,
      },
    },
    distanceMeters: 12,
  }],
}));

const getRouteQueryAPI = vi.fn(async () => ({
  listRouteLineStrings,
  listRouteBuildErrors,
  findNearestRouteLine,
}));

vi.mock('@hierarchidb/ui-worker-client', () => ({
  getBuildWorkerBridge: () => ({
    getRouteQueryAPI,
  }),
}));

vi.mock('@hierarchidb/ui-map', () => ({
  DEFAULT_MAP_CONFIG: {
    mapStyleUrl: '',
    interactionOptions: {},
  },
  buildCategoryFilter: () => ['all'],
  buildRoutePreviewRows: (rows: RouteLineString[]) => rows.map((row) => ({
    id: row.id,
    lineId: row.id,
    routeMode: row.routeMode,
    routeName: row.name,
    startName: row.startPoint.name,
    startAdmin0: row.startPoint.admin0Name,
    startAdmin1: row.startPoint.admin1Name,
    startAdmin2: row.startPoint.admin2Name,
    endName: row.endPoint.name,
    endAdmin0: row.endPoint.admin0Name,
    endAdmin1: row.endPoint.admin1Name,
    endAdmin2: row.endPoint.admin2Name,
    waypointCount: row.waypoints?.length,
    distanceMeters: row.distance ?? 0,
    speed: row.speed,
  })),
  useVectorTilePreviewSearch: vi.fn(),
}));

vi.mock('@hierarchidb/components', () => ({
  useFloatingWindow: () => ({
    windowState: {
      position: { x: 0, y: 0 },
      size: { width: 320, height: 240 },
      isVisible: true,
      isMinimized: false,
      isFullscreen: false,
      zIndex: 1000,
    },
    handlers: {
      onStateChange: vi.fn(),
      onClose: vi.fn(),
      onMinimize: vi.fn(),
      onRestore: vi.fn(),
      setPosition: vi.fn(),
      setSize: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
    },
  }),
}));

vi.mock('~/common/i18n/index', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? '',
    locale: 'en',
    translations: {},
  }),
  formatDistance: (value: number) => `${value}m`,
  getTransportModeName: () => 'Rail',
}));

import { useRoutePreviewStep } from '../useRoutePreviewStep.js';

const lineStringFixture: RouteLineString = {
  id: 'line-1',
  featureId: 'feature-1',
  nodeId: 'route-node-1',
  type: 'route-line',
  createdAt: 0,
  updatedAt: 0,
  version: 1,
  name: 'Route 1',
  routeMode: ROUTE_MODES.RAILWAY,
  startPoint: {
    latitude: 35,
    longitude: 139,
    locationName: 'Tokyo',
    name: 'Tokyo',
    admin0Name: 'Japan',
    admin1Name: 'Tokyo',
    admin2Name: 'Shinjuku',
  },
  endPoint: {
    latitude: 36,
    longitude: 140,
    locationName: 'Osaka',
    name: 'Osaka',
    admin0Name: 'Japan',
    admin1Name: 'Osaka',
    admin2Name: 'Kita',
  },
  waypoints: [
    [139, 35],
    [140, 36],
  ],
  distance: 2000,
};

class FakeMap {
  public container: HTMLElement;
  private readonly handlers: Map<string, (event: unknown) => void> = new Map();

  constructor() {
    this.container = document.createElement('div');
    document.body.appendChild(this.container);
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  getZoom(): number {
    return 11;
  }

  project(point: { lng: number; lat: number }): { x: number; y: number } {
    return {
      x: point.lng * 10,
      y: point.lat * 10,
    };
  }

  on(eventName: string, handler: (event: unknown) => void): void {
    this.handlers.set(eventName, handler);
  }

  off(eventName: string): void {
    this.handlers.delete(eventName);
  }

  trigger(eventName: string, event: unknown): void {
    const handler = this.handlers.get(eventName);
    if (handler) handler(event);
  }
}

describe('useRoutePreviewStep hover popup closing', () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  const createHook = () => renderHook(() => useRoutePreviewStep({
    draft: {},
    nodeId: 'route-node-1',
    onUpdate: vi.fn(),
  }));

  const waitForMatches = async () => {
    await waitFor(() => {
      expect(listRouteLineStrings).toHaveBeenCalledTimes(1);
      expect(getRouteQueryAPI).toHaveBeenCalled();
    });
  };

  it('closes popup on outside pointer click', async () => {
    const map = new FakeMap();
    const { result, unmount } = createHook();

    await waitForMatches();
    expect(result.current.lineStringsLoading).toBe(false);

    act(() => {
      result.current.setMapInstance(map as MapLibreMapInstance);
    });
    act(() => {
      map.trigger('click', {
        lngLat: {
          lng: 139,
          lat: 35,
        },
        point: {
          x: 0,
          y: 0,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.hoverSnackbarProps.matches).toHaveLength(1);
    });

    const outside = document.createElement('div');
    document.body.appendChild(outside);
    act(() => {
      outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });

    await waitFor(() => {
      expect(result.current.hoverSnackbarProps.matches).toHaveLength(0);
    });

    unmount();
  });

  it('closes popup on Escape keydown', async () => {
    const map = new FakeMap();
    const { result, unmount } = createHook();

    await waitForMatches();
    expect(result.current.lineStringsLoading).toBe(false);

    act(() => {
      result.current.setMapInstance(map as MapLibreMapInstance);
    });
    act(() => {
      map.trigger('click', {
        lngLat: {
          lng: 139,
          lat: 35,
        },
        point: {
          x: 0,
          y: 0,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.hoverSnackbarProps.matches).toHaveLength(1);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    await waitFor(() => {
      expect(result.current.hoverSnackbarProps.matches).toHaveLength(0);
    });

    unmount();
  });
});
