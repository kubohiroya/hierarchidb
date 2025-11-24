import type { PluginStepConfig, StepComponentProps } from '@hierarchidb/plugin-base';
import type { BasemapDraftUiState, MapStyle, MapViewport } from '../../common/types/BaseMapEntity.js';
import { MapStyleStep } from './steps/MapStyleStep.js';
import { ViewportStep } from './steps/ViewportStep.js';
import { normalizeMapStyle, normalizeViewport } from '../hooks/useBaseMapEntity.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const normalizeUiState = (
  current: BasemapDraftUiState | undefined,
  fallbackTouched: boolean
): BasemapDraftUiState => ({
  mapStyleTouched:
    typeof current?.mapStyleTouched === 'boolean'
      ? current.mapStyleTouched
      : fallbackTouched,
  viewportTouched:
    typeof current?.viewportTouched === 'boolean'
      ? current.viewportTouched
      : fallbackTouched,
});

const pickDraft = (input: Record<string, unknown>): Record<string, unknown> => {
  const mapStyle = normalizeMapStyle(input.mapStyle as Partial<MapStyle> | undefined);
  const viewport = normalizeViewport(input.viewport as Partial<MapViewport> | undefined);
  const name = typeof input.name === 'string' ? input.name : undefined;
  const description = typeof input.description === 'string' ? input.description : undefined;
  const tags = toStringArray(input.tags);
  return {
    mapStyle,
    viewport,
    ...(name ? { name } : {}),
    ...(description ? { description } : {}),
    ...(tags.length ? { tags } : {}),
  };
};

export type BasemapStepData = {
  mapStyle: MapStyle;
  viewport: MapViewport;
  name?: string;
  description?: string;
  tags?: string[];
  uiState?: BasemapDraftUiState;
};

const ensureDraft = (data?: Record<string, unknown>): BasemapStepData => {
  const record = isRecord(data) ? data : {};
  const normalized = pickDraft(record);
  const tagsValue = Array.isArray((normalized as { tags?: unknown }).tags)
    ? ((normalized as { tags?: unknown }).tags as string[])
    : undefined;
  return {
    mapStyle: normalized.mapStyle as MapStyle,
    viewport: normalized.viewport as MapViewport,
    name: typeof normalized.name === 'string' ? normalized.name : undefined,
    description: typeof normalized.description === 'string' ? normalized.description : undefined,
    tags: tagsValue,
    uiState: normalizeUiState(
      (record.uiState as BasemapDraftUiState | undefined) ?? undefined,
      isRecord(record.mapStyle) || isRecord(record.viewport)
    ),
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
    name: updates.name ?? current.name,
    description: updates.description ?? current.description,
    tags: updates.tags ?? current.tags,
  });

  const mergedTags = Array.isArray((mergedDraft as { tags?: unknown }).tags)
    ? ((mergedDraft as { tags?: unknown }).tags as string[])
    : current.tags;

  return {
    mapStyle: mergedDraft.mapStyle as MapStyle,
    viewport: mergedDraft.viewport as MapViewport,
    name: typeof mergedDraft.name === 'string' ? mergedDraft.name : updates.name ?? current.name,
    description:
      typeof mergedDraft.description === 'string'
        ? mergedDraft.description
        : updates.description ?? current.description,
    tags: mergedTags,
    uiState: {
      mapStyleTouched: updates.uiState?.mapStyleTouched ?? current.uiState?.mapStyleTouched ?? false,
      viewportTouched: updates.uiState?.viewportTouched ?? current.uiState?.viewportTouched ?? false,
    },
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
            uiState: {
              ...(draft.uiState ?? {}),
              mapStyleTouched: true,
            },
          })
        );
      const selectedStyle = draft.mapStyle ?? (p.mode === 'edit' ? draft.mapStyle : undefined);
      return <MapStyleStep value={selectedStyle} onChange={handleChange} />;
    },
    validate: (data?: BasemapStepData) => {
      try {
        const style = data?.mapStyle?.style;
        if (!style) return false;
        const touched = Boolean(data?.uiState?.mapStyleTouched);
        const hasPersistedStyle = Boolean(data?.mapStyle?.style);
        if (!touched && !hasPersistedStyle) return false;
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
            uiState: {
              ...(draft.uiState ?? {}),
              viewportTouched: true,
            },
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
      const touchedStyle = Boolean(data?.uiState?.mapStyleTouched || data?.mapStyle);
      if (!touchedStyle) return false;
      const viewport = data?.viewport;
      return hasValidViewport(viewport);
    },
  },
];
