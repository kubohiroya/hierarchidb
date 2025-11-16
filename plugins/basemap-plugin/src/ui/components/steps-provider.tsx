import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/plugin-base';
import type { MapStyle, MapViewport } from '../../common/types/BaseMapEntity.js';
import { MapStyleStep } from './steps/MapStyleStep.js';
import { ViewportStep } from './steps/ViewportStep.js';

type StepData = {
  mapStyle?: MapStyle;
  viewport?: MapViewport;
};

type P = StepComponentProps<StepData>;

const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider<StepData>({
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
        validate: (data?: StepData) => {
          try {
            const s = data?.mapStyle?.style;
            if (!s) return false;
            if (s === 'custom') {
              const url = data?.mapStyle?.customStyleUrl;
              new URL(String(url));
            }
            return true;
          } catch {
            return false;
          }
        },
      },
      {
        id: 'viewport',
        label: 'Map Viewport',
        componentFactory: (p: P) => (
          <ViewportStep
            value={p.data?.viewport}
            mapStyle={p.data?.mapStyle}
            mode={p.mode}
            nodeId={p.nodeId}
            onChange={(next) => p.onChange({ ...(p.data || {}), viewport: next })}
          />
        ),
        validate: (data?: StepData) => {
          try {
            const vp = data?.viewport;
            if (!vp) return false;
            const c = vp.center || [];
            const lng = Number(c[0]);
            const lat = Number(c[1]);
            const zoom = Number(vp.zoom);
            return (
              Number.isFinite(lng) &&
              lng >= -180 &&
              lng <= 180 &&
              Number.isFinite(lat) &&
              lat >= -90 &&
              lat <= 90 &&
              Number.isFinite(zoom) &&
              zoom >= 0 &&
              zoom <= 24
            );
          } catch {
            return false;
          }
        },
      },
    ];
  },
  getEditStepConfigs(_nodeId: string, _data?: StepData) {
    return this.getCreateStepConfigs();
  },
});
