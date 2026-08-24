import { type ChangeEvent, useCallback, useMemo } from 'react';
import type { ShapeBuildConfig } from '~/common/types/BuildTaskResult';
import { applyBuildConfigPatch } from '~/services/utils/shapeBuildUtils';

type UpdateFn = (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;

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

export type SourceGeometryIntakeGuardCardState = {
  resolvedGuard: GeometryIntakeGuardState;
  handleValidationLevelChange: (_event: unknown, value: string | null) => void;
  handleDedupeEpsilonChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleMinRingAreaThresholdChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleNormalizeRingOrientationChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleKeepBaselineSnapshotChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export const useSourceGeometryIntakeGuardCardState = (
  config: ShapeBuildConfig,
  onChange: UpdateFn
): SourceGeometryIntakeGuardCardState => {
  const resolvedGuard = useMemo(() => resolveGeometryIntakeGuard(config), [config]);
  const updateGuard = useCallback(
    (partial: Partial<GeometryIntakeGuardState>): void => {
      onChange((previousConfig) =>
        applyBuildConfigPatch(previousConfig, {
          sourceConfig: {
            ...previousConfig.sourceConfig,
            geometryIntakeGuard: {
              ...resolveGeometryIntakeGuard(previousConfig),
              ...partial,
            },
          },
        })
      );
    },
    [onChange]
  );

  const handleValidationLevelChange = useCallback(
    (_event: unknown, value: string | null) => {
      if (value === null) return;
      if (value !== 'off' && value !== 'basic' && value !== 'strict') return;
      updateGuard({ validationLevel: value });
    },
    [updateGuard]
  );

  const handleDedupeEpsilonChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (!Number.isFinite(value)) return;
      updateGuard({ dedupeEpsilon: Math.max(0, value) });
    },
    [updateGuard]
  );

  const handleMinRingAreaThresholdChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (!Number.isFinite(value)) return;
      updateGuard({ minRingAreaThreshold: Math.max(0, value) });
    },
    [updateGuard]
  );

  const handleNormalizeRingOrientationChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateGuard({ normalizeRingOrientation: event.target.checked });
    },
    [updateGuard]
  );

  const handleKeepBaselineSnapshotChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateGuard({ keepBaselineSnapshot: event.target.checked });
    },
    [updateGuard]
  );

  return {
    resolvedGuard,
    handleValidationLevelChange,
    handleDedupeEpsilonChange,
    handleMinRingAreaThresholdChange,
    handleNormalizeRingOrientationChange,
    handleKeepBaselineSnapshotChange,
  };
};
