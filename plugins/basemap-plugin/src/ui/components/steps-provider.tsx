import { PluginStepRegistry, type StepComponentProps } from '@hierarchidb/plugin-base';
import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import { BasicInfoStep as SharedBasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import type { BaseMapWorkingCopy, MapStyle, MapViewport } from '../../common/types/BaseMapEntity.js';
import { MapStyleStep } from './steps/MapStyleStep.js';
import { ViewportStep } from './steps/ViewportStep.js';
import { normalizeMapStyle, normalizeViewport } from '../hooks/useBaseMapEntity.js';

const registry = PluginStepRegistry.getInstance();

const TAG_SUGGESTIONS: string[] = ['basemap', 'map'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const DEFAULT_STYLE: MapStyle = { style: 'streets' };
const DEFAULT_VIEWPORT: MapViewport = {
  center: [0, 0],
  zoom: 2,
  bearing: 0,
  pitch: 0,
};

const ensureWorkingCopy = (data?: BaseMapWorkingCopy | Record<string, unknown>): BaseMapWorkingCopy => {
  const now = Date.now() as Timestamp;
  if (data && isRecord(data) && 'draft' in data) {
    const cast = data as BaseMapWorkingCopy;
    return {
      ...cast,
      treeNodeId: cast.treeNodeId ?? ('' as NodeId),
      createdAt: cast.createdAt ?? now,
      updatedAt: cast.updatedAt ?? now,
      draft: { ...(cast.draft ?? {}) },
      mapStyle: cast.mapStyle ?? DEFAULT_STYLE,
      viewport: cast.viewport ?? DEFAULT_VIEWPORT,
      tags: cast.tags ?? [],
    } satisfies BaseMapWorkingCopy;
  }

  const record = isRecord(data) ? data : {};
  const normalizedStyle = normalizeMapStyle(record.mapStyle as Partial<MapStyle> | undefined);
  const normalizedViewport = normalizeViewport(record.viewport as Partial<MapViewport> | undefined);
  return {
    treeNodeId: '' as NodeId,
    createdAt: now,
    updatedAt: now,
    version: 1,
    mapStyle: normalizedStyle,
    viewport: normalizedViewport,
    draft: {
      mapStyle: normalizedStyle,
      viewport: normalizedViewport,
      name: typeof record.name === 'string' ? record.name : undefined,
      description: typeof record.description === 'string' ? record.description : undefined,
    },
    tags: toStringArray(record.tags),
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

registry.registerConfigProvider<BaseMapWorkingCopy>({
  nodeType: 'basemap',
  getCreateStepConfigs() {
    return [
      {
        id: 'basic-info',
        label: 'Basic Information',
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data as BaseMapWorkingCopy | Record<string, unknown>);
          return (
            <SharedBasicInfoStep
              name={workingCopy.draft?.name ?? ''}
              description={workingCopy.draft?.description ?? ''}
              tags={workingCopy.tags ?? []}
              mode={p.mode}
              tagSuggestions={TAG_SUGGESTIONS}
              validate={({ name }) => (name.trim().length ? null : 'Name is required')}
              onChange={(value: BasicInfoData) => {
                p.onChange(
                  mergeWorkingCopy(workingCopy, {
                    draft: {
                      ...workingCopy.draft,
                      name: value.name,
                      description: value.description,
                    },
                    tags: value.tags,
                  })
                );
              }}
            />
          );
        },
        validate: (data?: BaseMapWorkingCopy) => Boolean(data?.draft?.name?.trim()),
      },
      {
        id: 'map-style',
        label: 'Map Style',
        componentFactory: (p: StepProps) => {
          const workingCopy = ensureWorkingCopy(p.data as BaseMapWorkingCopy | Record<string, unknown>);
          return (
            <MapStyleStep
              value={workingCopy.draft?.mapStyle}
              onChange={(next) =>
                p.onChange(
                  mergeWorkingCopy(workingCopy, {
                    draft: {
                      ...workingCopy.draft,
                      mapStyle: next,
                    },
                  })
                )
              }
            />
          );
        },
        validate: (data?: BaseMapWorkingCopy) => {
          try {
            const style = data?.draft?.mapStyle?.style;
            if (!style) return false;
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
          const workingCopy = ensureWorkingCopy(p.data as BaseMapWorkingCopy | Record<string, unknown>);
          return (
            <ViewportStep
              value={workingCopy.draft?.viewport}
              mapStyle={workingCopy.draft?.mapStyle}
              mode={p.mode}
              nodeId={p.nodeId as NodeId | undefined}
              onChange={(next) =>
                p.onChange(
                  mergeWorkingCopy(workingCopy, {
                    draft: {
                      ...workingCopy.draft,
                      viewport: next,
                    },
                  })
                )
              }
            />
          );
        },
        validate: (data?: BaseMapWorkingCopy) => hasValidViewport(data?.draft?.viewport),
      },
    ];
  },
  getEditStepConfigs() {
    return this.getCreateStepConfigs();
  },
});
