import type { PluginStepConfig, StepComponentProps } from '@hierarchidb/plugin-base';
import type { BaseMapEntity, MapStyle, MapViewport } from '../../common/types/BaseMapEntity.js';
import { MapStyleStep } from './steps/MapStyleStep.js';
import { ViewportStep } from './steps/ViewportStep.js';
import { normalizeMapStyle, normalizeViewport } from '../hooks/useBaseMapEntity.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const pickDraft = (input: Record<string, unknown>): Record<string, unknown> => {
  const mapStyle = normalizeMapStyle(input.mapStyle as Partial<MapStyle> | undefined);
  const viewport = normalizeViewport(input.viewport as Partial<MapViewport> | undefined);
  return {
    mapStyle,
    viewport,
  };
};

// Use the concrete entity type directly to avoid ambiguous step data shapes.
export type BasemapStepData = Partial<BaseMapEntity>;

const ensureDraft = (data?: Record<string, unknown>): BasemapStepData => {
  const record = isRecord(data) ? data : {};
  const normalized = pickDraft(record);
  return {
    mapStyle: normalized.mapStyle as MapStyle,
    viewport: normalized.viewport as MapViewport,
  };
};

const mergeDraft = (
  current: BasemapStepData,
  updates: Partial<BasemapStepData>
): BasemapStepData => {
  const mergedDraft = pickDraft({
    ...current,
    ...updates,
    mapStyle: updates.mapStyle ?? current.mapStyle,
    viewport: updates.viewport ?? current.viewport,
  });

  return {
    mapStyle: mergedDraft.mapStyle as MapStyle,
    viewport: mergedDraft.viewport as MapViewport,
  };
};

type StepProps = StepComponentProps<BasemapStepData>;

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

export const getBasemapStepConfigs = (): PluginStepConfig<BasemapStepData>[] => [
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
    validate: (data?: BasemapStepData) => {
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
      return (
        <ViewportStep
          value={draft.viewport}
          mapStyle={draft.mapStyle}
          onChange={handleViewportChange}
        />
      );
    },
    validate: (data?: BasemapStepData) => {
      if (!data?.mapStyle) return false;
      const viewport = data?.viewport;
      return hasValidViewport(viewport);
    },
  },
];
