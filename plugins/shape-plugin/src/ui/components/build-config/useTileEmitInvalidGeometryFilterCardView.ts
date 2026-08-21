import type { TileEmitInvalidGeometryFilterConfig } from '@hierarchidb/gis-sdk';
import { type ChangeEvent, useCallback, useMemo } from 'react';
import type { ShapeBuildConfig } from '~/common/types/index';
import { applyBuildConfigPatch } from '~/common/types/index';

type UpdateFn = (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;

type SwitchItem = {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export const resolveTileEmitInvalidGeometryFilter = (
  config: ShapeBuildConfig
): TileEmitInvalidGeometryFilterConfig => {
  const value = config.tileEmitConfig.invalidGeometryFilter as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('[shape-ui] tileEmitConfig.invalidGeometryFilter is required');
  }
  const record = value as Record<string, unknown>;
  const keys: Array<keyof TileEmitInvalidGeometryFilterConfig> = [
    'area',
    'lineLength',
    'maxEdgeLength',
    'selfIntersection',
    'triangleRingRatio',
  ];
  for (const key of keys) {
    if (typeof record[key] !== 'boolean') {
      throw new Error(`[shape-ui] tileEmitConfig.invalidGeometryFilter.${key} must be boolean`);
    }
  }
  return record as TileEmitInvalidGeometryFilterConfig;
};

export const useTileEmitInvalidGeometryFilterCardView = (
  config: ShapeBuildConfig,
  onChange: UpdateFn,
  disabled: boolean | undefined,
  labels: Record<keyof TileEmitInvalidGeometryFilterConfig, string>
) => {
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
