import type { TileEmitInvalidGeometryFilterConfig } from '@hierarchidb/gis-sdk';
import { type ChangeEvent, useCallback, useMemo } from 'react';
import type { ShapeBuildConfig } from '~/common/types/index';
import { applyBuildConfigPatch } from '~/common/types/index';

type UpdateFn = (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;

export type SwitchItem = {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

const INVALID_GEOMETRY_FILTER_KEYS: readonly (keyof TileEmitInvalidGeometryFilterConfig)[] = [
  'area',
  'lineLength',
  'maxEdgeLength',
  'selfIntersection',
  'triangleRingRatio',
];
const INVALID_GEOMETRY_FILTER_KEY_SET = new Set<string>(INVALID_GEOMETRY_FILTER_KEYS);

export const resolveTileEmitInvalidGeometryFilter = (
  config: ShapeBuildConfig
): TileEmitInvalidGeometryFilterConfig => {
  const value = config.tileEmitConfig.invalidGeometryFilter as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('[shape-ui] tileEmitConfig.invalidGeometryFilter is required');
  }
  const record = value as Record<string, unknown>;
  for (const key of INVALID_GEOMETRY_FILTER_KEYS) {
    if (!Object.hasOwn(record, key) || typeof record[key] !== 'boolean') {
      throw new Error(`[shape-ui] tileEmitConfig.invalidGeometryFilter.${key} must be boolean`);
    }
  }
  const unsupportedKey = Object.keys(record).find(
    (key) => !INVALID_GEOMETRY_FILTER_KEY_SET.has(key)
  );
  if (unsupportedKey) {
    throw new Error(
      `[shape-ui] tileEmitConfig.invalidGeometryFilter.${unsupportedKey} is not supported`
    );
  }
  return record as TileEmitInvalidGeometryFilterConfig;
};

export type TileEmitInvalidGeometryFilterCardState = {
  switchGroups: Array<Array<SwitchItem>>;
};

export const useTileEmitInvalidGeometryFilterCardState = (
  config: ShapeBuildConfig,
  onChange: UpdateFn,
  disabled: boolean | undefined,
  labels: Record<keyof TileEmitInvalidGeometryFilterConfig, string>
): TileEmitInvalidGeometryFilterCardState => {
  const resolved = useMemo(() => resolveTileEmitInvalidGeometryFilter(config), [config]);
  const isDisabled = Boolean(disabled);
  const updateFilter = useCallback(
    (partial: Partial<TileEmitInvalidGeometryFilterConfig>): void => {
      onChange((previousConfig) =>
        applyBuildConfigPatch(previousConfig, {
          tileEmitConfig: {
            ...previousConfig.tileEmitConfig,
            invalidGeometryFilter: {
              ...resolveTileEmitInvalidGeometryFilter(previousConfig),
              ...partial,
            },
          },
        })
      );
    },
    [onChange]
  );

  const switchGroups: Array<Array<SwitchItem>> = useMemo(
    () => [
      [
        {
          checked: resolved.selfIntersection,
          disabled: isDisabled,
          label: labels.selfIntersection,
          onChange: (event) => updateFilter({ selfIntersection: event.target.checked }),
        },
        {
          checked: resolved.triangleRingRatio,
          disabled: isDisabled,
          label: labels.triangleRingRatio,
          onChange: (event) => updateFilter({ triangleRingRatio: event.target.checked }),
        },
      ],
      [
        {
          checked: resolved.area,
          disabled: isDisabled,
          label: labels.area,
          onChange: (event) => updateFilter({ area: event.target.checked }),
        },
        {
          checked: resolved.lineLength,
          disabled: isDisabled,
          label: labels.lineLength,
          onChange: (event) => updateFilter({ lineLength: event.target.checked }),
        },
        {
          checked: resolved.maxEdgeLength,
          disabled: isDisabled,
          label: labels.maxEdgeLength,
          onChange: (event) => updateFilter({ maxEdgeLength: event.target.checked }),
        },
      ],
    ],
    [
      isDisabled,
      labels.area,
      labels.lineLength,
      labels.maxEdgeLength,
      labels.selfIntersection,
      labels.triangleRingRatio,
      resolved.area,
      resolved.lineLength,
      resolved.maxEdgeLength,
      resolved.selfIntersection,
      resolved.triangleRingRatio,
      updateFilter,
    ]
  );

  return { switchGroups };
};
