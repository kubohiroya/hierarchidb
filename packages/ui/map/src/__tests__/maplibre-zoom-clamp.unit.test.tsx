import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { MapViewState } from '../types/unified-map-props';
import { DEFAULT_MAP_CONFIG } from '../types/unified-map-props';

const mapProps: Array<Record<string, unknown>> = [];

vi.mock('@vis.gl/react-maplibre', () => ({
  Map: (props: Record<string, unknown>) => {
    mapProps.push(props);
    return null;
  },
  MapProvider: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}), { virtual: true });

import { MapLibreMap } from '../components/MapLibreMap';

const baseViewState: MapViewState = {
  longitude: 139.7,
  latitude: 35.6,
  zoom: 0,
};

describe('MapLibreMap zoom clamp', () => {
  beforeEach(() => {
    mapProps.length = 0;
  });

  it('clamps initialViewState zoom to min/max', () => {
    render(
      <MapLibreMap
        initialViewState={{ ...baseViewState, zoom: -5 }}
        mapStyleUrl="about:blank"
        mapOptions={{ minZoom: 2, maxZoom: 10 }}
      />
    );
    const props = mapProps[0] as { initialViewState?: MapViewState };
    expect(props.initialViewState?.zoom).toBe(2);
  });


  it('applies default min/max zoom when mapOptions omit them', () => {
    render(
      <MapLibreMap
        initialViewState={baseViewState}
        mapStyleUrl="about:blank"
        mapOptions={{ interactive: true }}
      />
    );
    const props = mapProps[0] as { minZoom?: number; maxZoom?: number };
    expect(props.minZoom).toBe(DEFAULT_MAP_CONFIG.interactionOptions.minZoom);
    expect(props.maxZoom).toBe(DEFAULT_MAP_CONFIG.interactionOptions.maxZoom);
  });

  it('clamps viewState zoom to min/max', () => {
    render(
      <MapLibreMap
        initialViewState={baseViewState}
        viewState={{ ...baseViewState, zoom: 99 }}
        mapStyleUrl="about:blank"
        mapOptions={{ minZoom: 2, maxZoom: 10 }}
      />
    );
    const props = mapProps[0] as { viewState?: MapViewState };
    expect(props.viewState?.zoom).toBe(10);
  });
});
