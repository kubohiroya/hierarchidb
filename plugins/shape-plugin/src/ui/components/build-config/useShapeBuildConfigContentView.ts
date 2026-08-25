import type { NodeId } from '@hierarchidb/core-types';
import { useHeapPressureMonitor } from '@hierarchidb/ui-memory';
import type { AlertColor } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ShapeBuildConfig, ShapeRuntimeBuildConfig } from '~/common/types/BuildTaskResult';
import { DEFAULT_PROCESSING_CONFIG } from '~/common/types/constants';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import {
  applyBuildConfigPatch,
  composeRuntimeBuildConfig,
  mergeProcessingConfig,
} from '~/services/utils/shapeBuildUtils';
import {
  filteringHighUrl,
  filteringLowUrl,
  filteringMediumUrl,
} from '~/ui/assets/filtering-samples/filteringSampleConstants';
import { useSourceConfigSection } from '~/ui/hooks/useSourceConfigSection';

const toBuildConfigUpdate = (
  partial: Partial<ShapeRuntimeBuildConfig>
): Partial<ShapeBuildConfig> => {
  const next: Partial<ShapeBuildConfig> = {};
  if (partial.dataSourceName !== undefined) {
    next.dataSourceName = partial.dataSourceName;
  }
  if (partial.sourceConfig) {
    const {
      maxConcurrent: _ignoredConcurrency,
      retryAttempts: _ignoredRetryAttempts,
      retryDelay: _ignoredRetryDelay,
      retryLimit: _ignoredRetryLimit,
      retryBackoff: _ignoredRetryBackoff,
      ...sourceConfig
    } = partial.sourceConfig;
    next.sourceConfig = sourceConfig;
  }
  if (partial.geometryConfig) {
    const { maxConcurrent: _ignoredConcurrency, ...geometryConfig } = partial.geometryConfig;
    next.geometryConfig = geometryConfig;
  }
  if (partial.tileEmitConfig) {
    const {
      maxConcurrent: _ignoredConcurrency,
      dynamicConcurrency: _ignoredDynamicConcurrency,
      ...tileEmitConfig
    } = partial.tileEmitConfig;
    next.tileEmitConfig = tileEmitConfig;
  }
  if (partial.borderGeometryConfig) {
    next.borderGeometryConfig = partial.borderGeometryConfig;
  }
  if (partial.cleanupConfig) {
    next.cleanupConfig = partial.cleanupConfig;
  }
  return next;
};

const areBuildConfigEqual = (left: ShapeBuildConfig, right: ShapeBuildConfig): boolean => {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return left === right;
  }
};

type Args = {
  config: ShapeBuildConfig;
  data: ShapeEntity | Partial<ShapeEntity> | undefined;
  nodeId: string | undefined;
  disabled: boolean | undefined;
  t: (key: string, fallback: string, params?: Record<string, unknown>) => string;
  registerStepDraftCommitter?: (committer: () => Partial<ShapeEntity>) => void | (() => void);
};

export const useShapeBuildConfigContentView = ({
  config,
  data,
  nodeId,
  disabled,
  t,
  registerStepDraftCommitter,
}: Args) => {
  const [workingConfig, setWorkingConfig] = useState<ShapeBuildConfig>(config);
  const workingConfigRef = useRef(config);
  const syncedConfigRef = useRef(config);

  useEffect(() => {
    if (areBuildConfigEqual(config, syncedConfigRef.current)) return;
    syncedConfigRef.current = config;
    workingConfigRef.current = config;
    setWorkingConfig(config);
  }, [config]);

  useEffect(() => {
    workingConfigRef.current = workingConfig;
  }, [workingConfig]);

  const processingConfig = useMemo(
    () => mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, data?.processingConfig),
    [data?.processingConfig]
  );
  const runtimeBuildConfig = useMemo(
    () => composeRuntimeBuildConfig(workingConfig, processingConfig),
    [processingConfig, workingConfig]
  );

  const filteringPreviewImages = useMemo(
    () => ({
      weak: filteringLowUrl,
      medium: filteringMediumUrl,
      strong: filteringHighUrl,
    }),
    []
  );

  const updateWorkingConfig = useCallback(
    (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => {
      setWorkingConfig((prevConfig) => {
        const nextConfig = typeof next === 'function' ? next(prevConfig) : next;
        if (areBuildConfigEqual(prevConfig, nextConfig)) {
          return prevConfig;
        }
        return nextConfig;
      });
    },
    []
  );

  const updateRuntimeBuildConfig = useCallback(
    (partial: Partial<ShapeRuntimeBuildConfig>) => {
      updateWorkingConfig((prevConfig) =>
        applyBuildConfigPatch(prevConfig, toBuildConfigUpdate(partial))
      );
    },
    [updateWorkingConfig]
  );

  useEffect(() => {
    if (!registerStepDraftCommitter) return;
    const unregister = registerStepDraftCommitter(() => ({
      buildConfig: workingConfigRef.current,
    }));
    if (typeof unregister === 'function') {
      return unregister;
    }
    return undefined;
  }, [registerStepDraftCommitter]);

  const fetchState = useSourceConfigSection({
    config: workingConfig,
    nodeId: nodeId as NodeId,
    disabled,
    onChange: updateWorkingConfig,
  });

  const { event: heapPressure } = useHeapPressureMonitor();
  const heapWarning = useMemo(() => {
    if (!heapPressure) return null;
    const usedMb = Math.round(heapPressure.usedBytes / (1024 * 1024));
    const limitMb = Math.round(heapPressure.limitBytes / (1024 * 1024));
    const ratioPercent = Math.round(heapPressure.ratio * 100);
    return {
      severity: (heapPressure.level === 'critical' ? 'error' : 'warning') as AlertColor,
      message: t(
        'processing.heap.warning',
        'High JS heap usage detected ({{ratio}}% / {{used}}MB of {{limit}}MB). Consider reducing concurrency.',
        {
          ratio: ratioPercent,
          used: usedMb,
          limit: limitMb,
        }
      ),
    };
  }, [heapPressure, t]);

  return {
    fetchState,
    filteringPreviewImages,
    heapWarning,
    runtimeBuildConfig,
    updateWorkingConfig,
    updateRuntimeBuildConfig,
    workingConfig,
  };
};
