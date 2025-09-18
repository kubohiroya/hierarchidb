import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/runtime-ui-plugin-dialog';
import type { MapStyle, MapViewport, DisplayOptions } from '../types/BaseMapEntity.js';
import { MapStyleStep } from './steps/MapStyleStep.js';
import { ViewportStep } from './steps/ViewportStep.js';
import { DisplayOptionsStep } from './steps/DisplayOptionsStep.js';

type P = StepComponentProps & { data: { mapStyle?: MapStyle; viewport?: MapViewport; displayOptions?: DisplayOptions } };

const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider({
  nodeType: 'basemap',
  getCreateStepConfigs() {
    return [
      {
        id: 'map-style',
        label: 'Map Style',
        componentFactory: (p: P) => (
          <MapStyleStep
            value={p.data?.mapStyle}
            onChange={(next) => p.onChange({ ...(p.data || {}), mapStyle: next })}
          />
        ),
        validate: (data?: any) => {
          try {
            const s = data?.mapStyle?.style;
            if (!s) return false;
            if (s === 'custom') {
              const url = data?.mapStyle?.customStyleUrl;
              new URL(String(url));
            }
            return true;
          } catch { return false; }
        },
      },
      {
        id: 'viewport',
        label: 'Map Viewport',
        componentFactory: (p: P) => (
          <ViewportStep
            value={p.data?.viewport}
            onChange={(next) => p.onChange({ ...(p.data || {}), viewport: next })}
          />
        ),
        validate: (data?: any) => {
          try {
            const vp = data?.viewport;
            if (!vp) return false;
            const c = vp.center || [];
            const lng = Number(c[0]);
            const lat = Number(c[1]);
            const zoom = Number(vp.zoom);
            return isFinite(lng) && lng >= -180 && lng <= 180 &&
                   isFinite(lat) && lat >= -90 && lat <= 90 &&
                   isFinite(zoom) && zoom >= 0 && zoom <= 24;
          } catch { return false; }
        },
      },
      {
        id: 'display-options',
        label: 'Display Options',
        componentFactory: (p: P) => (
          <DisplayOptionsStep
            value={p.data?.displayOptions}
            onChange={(next) => p.onChange({ ...(p.data || {}), displayOptions: next })}
          />
        ),
        validate: () => true,
      },
    ];
  },
  getEditStepConfigs() { return this.getCreateStepConfigs(); },
});
