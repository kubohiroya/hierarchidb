import type { PluginStepConfig, StepComponentProps } from '@hierarchidb/plugin-base';
import type { BaseMapEntity, MapStyle, MapViewport } from '../../common/types/BaseMapEntity.js';
import { MapStyleStep } from './steps/MapStyleStep.js';
import { ViewportStep } from './steps/ViewportStep.js';
import { DEFAULT_MAP_STYLE, DEFAULT_VIEWPORT } from '../hooks/useBaseMapEntity.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// Use the concrete entity type directly to avoid ambiguous step data shapes.
// export type BasemapStepData = Partial<BaseMapEntity>;

const ensureDraft = (data?: Record<string, unknown>): Partial<BaseMapEntity> => {
  const record = isRecord(data) ? data : {};
  return {
    mapStyle: (record.mapStyle as MapStyle) ?? DEFAULT_MAP_STYLE,
    viewport: (record.viewport as MapViewport) ?? DEFAULT_VIEWPORT,
  };
};

const mergeDraft = (
  current: Partial<BaseMapEntity>,
  updates: Partial<BaseMapEntity>
): Partial<BaseMapEntity> => {
  return {
    mapStyle: (updates.mapStyle as MapStyle) ?? current.mapStyle ?? DEFAULT_MAP_STYLE,
    viewport: (updates.viewport as MapViewport) ?? current.viewport ?? DEFAULT_VIEWPORT,
  };
};

type StepProps = StepComponentProps<Partial<BaseMapEntity>>;

const hasValidViewport = (value?: MapViewport): boolean => {
  if (!value) return false;
  const [lng, lat] = value.center ?? [];
  const zoom = value.zoom;
  return (
    Array.isArray(value.center) &&
    value.center.length === 2 &&
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
};

export const getBasemapStepConfigs = (): PluginStepConfig<Partial<BaseMapEntity>>[] => [
  {
    id: 'map-style',
    label: 'Map Style',
    componentFactory: (p: StepProps) => {
      const draft = ensureDraft(p.data);
      const handleChange = (next: MapStyle) =>
        p.onChange(
          mergeDraft(draft, {
            mapStyle: next,
          })
        );
      const selectedStyle = draft.mapStyle ?? (p.mode === 'edit' ? draft.mapStyle : undefined);
      return <MapStyleStep value={selectedStyle} onChange={handleChange} />;
    },
    validate: (data?: Partial<BaseMapEntity>) => {
      try {
        const style = data?.mapStyle?.style;
        if (!style) return false;
        if (style === 'custom') {
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
    componentFactory: (p: StepProps) => {
      const draft = ensureDraft(p.data);
      const handleViewportChange = (next: MapViewport) =>
        p.onChange(
          mergeDraft(draft, {
            viewport: next,
          })
        );
      if (!draft.viewport) {
        throw new Error('[Basemap] Viewport is not initialized');
      }
      return (
        <ViewportStep
          value={draft.viewport}
          mapStyle={draft.mapStyle}
          onChange={handleViewportChange}
        />
      );
    },
    validate: (data?: Partial<BaseMapEntity>) => {
      if (!data?.mapStyle) return false;
      const viewport = data?.viewport;
      return hasValidViewport(viewport);
    },
  },
];
