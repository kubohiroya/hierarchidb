import type { PluginStepConfig, StepComponentProps } from '@hierarchidb/plugin-base';
import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import type {
  BaseMapWorkingCopy,
  BasemapWorkingCopyUiState,
  MapStyle,
  MapViewport,
} from '../../common/types/BaseMapEntity.js';
import { MapStyleStep } from './steps/MapStyleStep.js';
import { ViewportStep } from './steps/ViewportStep.js';
import { normalizeMapStyle, normalizeViewport } from '../hooks/useBaseMapEntity.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const DEFAULT_STYLE: MapStyle = { style: 'streets' };
const DEFAULT_VIEWPORT: MapViewport = {
  center: [139.767, 35.681],
  zoom: 10,
  bearing: 0,
  pitch: 0,
};

const normalizeUiState = (
  current: BasemapWorkingCopyUiState | undefined,
  fallbackTouched: boolean
): BasemapWorkingCopyUiState => ({
  mapStyleTouched:
    typeof current?.mapStyleTouched === 'boolean'
      ? current.mapStyleTouched
      : fallbackTouched,
  viewportTouched:
    typeof current?.viewportTouched === 'boolean'
      ? current.viewportTouched
      : fallbackTouched,
});

const readBasicInfoOverrides = (
  data?: BaseMapWorkingCopy | Record<string, unknown>
): { name?: string; description?: string; tags?: string[] } => {
  const record = isRecord(data) ? data : undefined;
  const draftRecord = isRecord(record?.draft) ? (record!.draft as Record<string, unknown>) : undefined;
  const nameCandidate =
    typeof record?.name === 'string'
      ? record.name
      : typeof draftRecord?.name === 'string'
        ? draftRecord.name
        : undefined;
  const descriptionCandidate =
    typeof record?.description === 'string'
      ? record.description
      : typeof draftRecord?.description === 'string'
        ? draftRecord.description
        : undefined;
  const tags = toStringArray(record?.tags ?? draftRecord?.tags);
  return {
    name: nameCandidate,
    description: descriptionCandidate,
    tags: tags.length ? tags : undefined,
  };
};

const isBasemapWorkingCopyRecord = (value: unknown): value is BaseMapWorkingCopy =>
  isRecord(value) &&
  'draft' in value &&
  'treeNodeId' in value &&
  'createdAt' in value &&
  'updatedAt' in value;

const ensureWorkingCopy = (
  data?: BaseMapWorkingCopy | Record<string, unknown>
): BaseMapWorkingCopy => {
  const now = Date.now() as Timestamp;
  if (isBasemapWorkingCopyRecord(data)) {
    const cast = data;
    const fallbackTouched = typeof cast.originalVersion === 'number';
    const normalizedStyle = normalizeMapStyle(
      cast.draft?.mapStyle ?? cast.mapStyle ?? DEFAULT_STYLE
    );
    const normalizedViewport = normalizeViewport(
      cast.draft?.viewport ?? cast.viewport ?? DEFAULT_VIEWPORT
    );
    const overrides = readBasicInfoOverrides(cast);
    const rootName = overrides.name ?? cast.name;
    const rootDescription = overrides.description ?? cast.description;
    const normalizedTags = overrides.tags ?? cast.tags ?? toStringArray((cast.draft as { tags?: unknown })?.tags);
    return {
      ...cast,
      treeNodeId: cast.treeNodeId ?? ('' as NodeId),
      createdAt: cast.createdAt ?? now,
      updatedAt: cast.updatedAt ?? now,
      draft: {
        ...(cast.draft ?? {}),
        mapStyle: normalizedStyle,
        viewport: normalizedViewport,
        name: typeof cast.draft?.name === 'string' ? cast.draft.name : rootName,
        description:
          typeof cast.draft?.description === 'string' ? cast.draft.description : rootDescription,
      },
      mapStyle: normalizedStyle,
      viewport: normalizedViewport,
      tags: normalizedTags,
      uiState: normalizeUiState(cast.uiState, fallbackTouched),
    } satisfies BaseMapWorkingCopy;
  }

  const record = isRecord(data) ? data : {};
  const normalizedStyle = normalizeMapStyle(record.mapStyle as Partial<MapStyle> | undefined);
  const normalizedViewport = normalizeViewport(record.viewport as Partial<MapViewport> | undefined);
  const overrides = readBasicInfoOverrides(record);
  const hasPersistedStyle = isRecord(record.mapStyle);
  const hasPersistedViewport = isRecord(record.viewport);
  return {
    treeNodeId: '' as NodeId,
    createdAt: now,
    updatedAt: now,
    version: 1,
    mapStyle: normalizedStyle,
    viewport: normalizedViewport,
    draft: {
      mapStyle: undefined,
      viewport: undefined,
      name: overrides.name,
      description: overrides.description,
    },
    tags: overrides.tags ?? toStringArray(record.tags),
    uiState: {
      mapStyleTouched: hasPersistedStyle,
      viewportTouched: hasPersistedViewport,
    },
  } satisfies BaseMapWorkingCopy;
};

const mergeWorkingCopy = (
  current: BaseMapWorkingCopy,
  updates: Partial<BaseMapWorkingCopy>
): BaseMapWorkingCopy => ({
  ...current,
  ...updates,
  draft: {
    ...(current.draft ?? {}),
    ...(updates.draft ?? {}),
  },
  mapStyle: updates.draft?.mapStyle ?? updates.mapStyle ?? current.mapStyle,
  viewport: updates.draft?.viewport ?? updates.viewport ?? current.viewport,
  uiState: {
    mapStyleTouched:
      updates.uiState?.mapStyleTouched ?? current.uiState?.mapStyleTouched ?? false,
    viewportTouched:
      updates.uiState?.viewportTouched ?? current.uiState?.viewportTouched ?? false,
  },
});

type StepProps = StepComponentProps<BaseMapWorkingCopy>;

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

export const getBasemapStepConfigs = (): PluginStepConfig<BaseMapWorkingCopy>[] => [
      {
        id: 'map-style',
        label: 'Map Style',
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data);
          const handleChange = (next: MapStyle) =>
            p.onChange(
              mergeWorkingCopy(workingCopy, {
                draft: {
                  ...workingCopy.draft,
                  mapStyle: next,
                },
                uiState: {
                  ...(workingCopy.uiState ?? {}),
                  mapStyleTouched: true,
                },
              })
            );
          const selectedStyle =
            workingCopy.draft?.mapStyle ??
            (p.mode === 'edit' ? workingCopy.mapStyle : undefined);
          return <MapStyleStep value={selectedStyle} onChange={handleChange} />;
        },
        validate: (data?: BaseMapWorkingCopy) => {
          try {
            const style = data?.draft?.mapStyle?.style ?? data?.mapStyle?.style;
            if (!style) return false;
            const touched = Boolean(data?.uiState?.mapStyleTouched);
            const hasPersistedStyle = Boolean(data?.mapStyle?.style);
            if (!touched && !hasPersistedStyle) return false;
            if (style === 'custom') {
              const url = data?.draft?.mapStyle?.customStyleUrl;
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
          const workingCopy = ensureWorkingCopy(p.data);
          const handleViewportChange = (next: MapViewport) =>
            p.onChange(
              mergeWorkingCopy(workingCopy, {
                draft: {
                  ...workingCopy.draft,
                  viewport: next,
                },
                uiState: {
                  ...(workingCopy.uiState ?? {}),
                  viewportTouched: true,
                },
              })
            );
          return (
            <ViewportStep
              value={workingCopy.draft?.viewport ?? workingCopy.viewport}
              mapStyle={workingCopy.draft?.mapStyle ?? workingCopy.mapStyle}
              mode={p.mode}
              nodeId={p.nodeId as NodeId | undefined}
              onChange={handleViewportChange}
            />
          );
        },
        validate: (data?: BaseMapWorkingCopy) => {
          const touchedStyle = Boolean(data?.uiState?.mapStyleTouched || data?.mapStyle);
          if (!touchedStyle) return false;
          const viewport = data?.draft?.viewport ?? data?.viewport;
          return hasValidViewport(viewport);
        },
      },
    ];
