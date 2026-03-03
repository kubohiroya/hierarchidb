import { useCallback, useMemo, type ChangeEvent } from 'react';
import type { ShapeBuildConfig } from '~/common/types/index';
import { applyBuildConfigPatch } from '~/common/types/index';

type UpdateFn = (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;

export type InvalidGeometryFilterState = {
  area: boolean;
  lineLength: boolean;
  maxEdgeLength: boolean;
  selfIntersection: boolean;
  triangleRingRatio: boolean;
};

export type GeometryIntakeGuardState = {
  validationLevel: 'off' | 'basic' | 'strict';
  dedupeEpsilon: number;
  minRingAreaThreshold: number;
  normalizeRingOrientation: boolean;
  keepBaselineSnapshot: boolean;
};

export const resolveGeometryIntakeGuard = (config: ShapeBuildConfig): GeometryIntakeGuardState => {
  const guard = config.sourceConfig.geometryIntakeGuard;
  return {
    validationLevel: guard?.validationLevel ?? 'off',
    dedupeEpsilon: guard?.dedupeEpsilon ?? 0.000001,
    minRingAreaThreshold: guard?.minRingAreaThreshold ?? 0,
    normalizeRingOrientation: guard?.normalizeRingOrientation ?? true,
    keepBaselineSnapshot: guard?.keepBaselineSnapshot ?? true,
  };
};

export const resolveInvalidGeometryFilter = (config: ShapeBuildConfig): InvalidGeometryFilterState => ({
  area: config.tileEmitConfig.invalidGeometryFilter?.area ?? false,
  lineLength: config.tileEmitConfig.invalidGeometryFilter?.lineLength ?? false,
  maxEdgeLength: config.tileEmitConfig.invalidGeometryFilter?.maxEdgeLength ?? false,
  selfIntersection: config.tileEmitConfig.invalidGeometryFilter?.selfIntersection ?? false,
  triangleRingRatio: config.tileEmitConfig.invalidGeometryFilter?.triangleRingRatio ?? false,
});

export const useSourceGeometryIntakeGuardCardView = (config: ShapeBuildConfig, onChange: UpdateFn) => {
  const resolvedGuard = useMemo(() => resolveGeometryIntakeGuard(config), [config]);
  const updateGuard = useCallback((partial: Partial<GeometryIntakeGuardState>): void => {
    onChange((prevConfig) => {
      const current = resolveGeometryIntakeGuard(prevConfig);
      return applyBuildConfigPatch(prevConfig, {
        sourceConfig: {
          ...prevConfig.sourceConfig,
          geometryIntakeGuard: {
            ...current,
            ...partial,
          },
        },
      });
    });
  }, [onChange]);

  const handleValidationLevelChange = useCallback((_event: unknown, value: string | null) => {
    if (value === null) return;
    if (value !== 'off' && value !== 'basic' && value !== 'strict') return;
    updateGuard({ validationLevel: value });
  }, [updateGuard]);

  const handleDedupeEpsilonChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    updateGuard({ dedupeEpsilon: Math.max(0, value) });
  }, [updateGuard]);

  const handleMinRingAreaThresholdChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    updateGuard({ minRingAreaThreshold: Math.max(0, value) });
  }, [updateGuard]);

  const handleNormalizeRingOrientationChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    updateGuard({ normalizeRingOrientation: event.target.checked });
  }, [updateGuard]);

  const handleKeepBaselineSnapshotChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    updateGuard({ keepBaselineSnapshot: event.target.checked });
  }, [updateGuard]);

  return {
    resolvedGuard,
    handleValidationLevelChange,
    handleDedupeEpsilonChange,
    handleMinRingAreaThresholdChange,
    handleNormalizeRingOrientationChange,
    handleKeepBaselineSnapshotChange,
  };
};

type SwitchItem = {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export const useTileEmitInvalidGeometryFilterCardView = (
  config: ShapeBuildConfig,
  onChange: UpdateFn,
  disabled: boolean | undefined,
  labels: {
    selfIntersection: string;
    triangleRingRatio: string;
    area: string;
    lineLength: string;
    maxEdgeLength: string;
  },
) => {
  const resolved = useMemo(() => resolveInvalidGeometryFilter(config), [config]);
  const isDisabled = Boolean(disabled);
  const updateFilter = useCallback((partial: Partial<InvalidGeometryFilterState>): void => {
    onChange((prevConfig) => {
      const current = resolveInvalidGeometryFilter(prevConfig);
      return applyBuildConfigPatch(prevConfig, {
        tileEmitConfig: {
          ...prevConfig.tileEmitConfig,
          invalidGeometryFilter: {
            ...current,
            ...partial,
          },
        },
      });
    });
  }, [onChange]);

  const switchGroups: Array<Array<SwitchItem>> = useMemo(() => [
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
  ], [isDisabled, labels.area, labels.lineLength, labels.maxEdgeLength, labels.selfIntersection, labels.triangleRingRatio, resolved.area, resolved.lineLength, resolved.maxEdgeLength, resolved.selfIntersection, resolved.triangleRingRatio, updateFilter]);

  return {
    switchGroups,
  };
};
