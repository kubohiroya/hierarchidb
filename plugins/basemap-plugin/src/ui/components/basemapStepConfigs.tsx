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
  const payload = isRecord((record as any)?.draftData)
    ? ((record as any).draftData as Record<string, unknown>)
    : isRecord(record?.draft)
      ? (record!.draft as Record<string, unknown>)
      : undefined;
  const nameCandidate = typeof record?.name === 'string'
    ? record.name
    : typeof payload?.name === 'string'
      ? payload.name
      : undefined;
  const descriptionCandidate = typeof record?.description === 'string'
    ? record.description
    : typeof payload?.description === 'string'
      ? payload.description
      : undefined;
  const tags = toStringArray(record?.tags ?? payload?.tags);
  return {
    name: nameCandidate,
    description: descriptionCandidate,
    tags: tags.length ? tags : undefined,
  };
};

const isBasemapWorkingCopyRecord = (value: unknown): value is BaseMapWorkingCopy =>
  isRecord(value) && 'treeNodeId' in value && 'createdAt' in value && 'updatedAt' in value;

const ensureWorkingCopy = (
  data?: BaseMapWorkingCopy | Record<string, unknown>
): BaseMapWorkingCopy => {
  const now = Date.now() as Timestamp;
  if (isBasemapWorkingCopyRecord(data)) {
    const cast = data as any;
    const fallbackTouched = typeof cast.originalVersion === 'number';
    const payload = isRecord(cast.draftData)
      ? (cast.draftData as Record<string, unknown>)
      : isRecord(cast.draft)
        ? (cast.draft as Record<string, unknown>)
        : {};
    const normalizedStyle = normalizeMapStyle(
      (payload.mapStyle as Partial<MapStyle> | undefined) ?? cast.mapStyle ?? DEFAULT_STYLE
    );
    const normalizedViewport = normalizeViewport(
      (payload.viewport as Partial<MapViewport> | undefined) ?? cast.viewport ?? DEFAULT_VIEWPORT
    );
    const overrides = readBasicInfoOverrides(cast);
    const rootName = overrides.name ?? cast.name;
    const rootDescription = overrides.description ?? cast.description;
    const normalizedTags = overrides.tags ?? cast.tags ?? toStringArray(payload.tags);
    const draftPayload = {
      ...payload,
      mapStyle: normalizedStyle,
      viewport: normalizedViewport,
      name: typeof payload.name === 'string' ? payload.name : rootName,
      description: typeof payload.description === 'string' ? payload.description : rootDescription,
    };
    return {
      ...cast,
      treeNodeId: cast.treeNodeId ?? ('' as NodeId),
      createdAt: cast.createdAt ?? now,
      updatedAt: cast.updatedAt ?? now,
      draftData: draftPayload,
      draft: draftPayload as any,
      mapStyle: normalizedStyle,
      viewport: normalizedViewport,
      tags: normalizedTags,
      uiState: normalizeUiState(cast.uiState, fallbackTouched),
    } satisfies BaseMapWorkingCopy as any;
  }

  const record = isRecord(data) ? data : {};
  const normalizedStyle = normalizeMapStyle(record.mapStyle as Partial<MapStyle> | undefined);
  const normalizedViewport = normalizeViewport(record.viewport as Partial<MapViewport> | undefined);
  const overrides = readBasicInfoOverrides(record);
  const hasPersistedStyle = isRecord(record.mapStyle);
  const hasPersistedViewport = isRecord(record.viewport);
  const draftPayload: Record<string, unknown> = {
    mapStyle: normalizedStyle,
    viewport: normalizedViewport,
    name: overrides.name,
    description: overrides.description,
    tags: overrides.tags ?? toStringArray(record.tags),
  };
  return {
    treeNodeId: '' as NodeId,
    createdAt: now,
    updatedAt: now,
    version: 1,
    mapStyle: normalizedStyle,
    viewport: normalizedViewport,
    draftData: draftPayload,
    draft: draftPayload as any,
    tags: overrides.tags ?? toStringArray(record.tags),
    uiState: {
      mapStyleTouched: hasPersistedStyle,
      viewportTouched: hasPersistedViewport,
    },
  } satisfies BaseMapWorkingCopy as any;
};

const mergeWorkingCopy = (
  current: BaseMapWorkingCopy,
  updates: Partial<BaseMapWorkingCopy>
): BaseMapWorkingCopy => ({
  ...current,
  ...updates,
  draftData: {
    ...(current as any).draftData,
    ...(updates as any).draftData,
  },
  draft: {
    ...(current as any).draftData,
    ...(updates as any).draftData,
  } as any,
  mapStyle:
    (updates as any).draftData?.mapStyle ?? updates.mapStyle ?? (current as any).draftData?.mapStyle ?? current.mapStyle,
  viewport:
    (updates as any).draftData?.viewport ?? updates.viewport ?? (current as any).draftData?.viewport ?? current.viewport,
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
                draftData: {
                  ...(workingCopy as any).draftData,
                  mapStyle: next,
                },
                uiState: {
                  ...(workingCopy.uiState ?? {}),
                  mapStyleTouched: true,
                },
              })
            );
          const selectedStyle =
            (workingCopy as any).draftData?.mapStyle ??
            (p.mode === 'edit' ? (workingCopy as any).mapStyle : undefined);
          return <MapStyleStep value={selectedStyle} onChange={handleChange} />;
        },
        validate: (data?: BaseMapWorkingCopy) => {
          try {
            const style =
              (data as any)?.draftData?.mapStyle?.style ?? (data as any)?.mapStyle?.style;
            if (!style) return false;
            const touched = Boolean(data?.uiState?.mapStyleTouched);
            const hasPersistedStyle = Boolean(data?.mapStyle?.style);
            if (!touched && !hasPersistedStyle) return false;
            if (style === 'custom') {
              const url = (data as any)?.draftData?.mapStyle?.customStyleUrl;
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
                draftData: {
                  ...(workingCopy as any).draftData,
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
              value={(workingCopy as any).draftData?.viewport ?? workingCopy.viewport}
              mapStyle={(workingCopy as any).draftData?.mapStyle ?? workingCopy.mapStyle}
              mode={p.mode}
              nodeId={p.nodeId as NodeId | undefined}
              onChange={handleViewportChange}
            />
          );
        },
        validate: (data?: BaseMapWorkingCopy) => {
          const touchedStyle = Boolean(data?.uiState?.mapStyleTouched || data?.mapStyle);
          if (!touchedStyle) return false;
          const viewport = (data as any)?.draftData?.viewport ?? data?.viewport;
          return hasValidViewport(viewport);
        },
      },
    ];
