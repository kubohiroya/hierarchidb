import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import type { AlertColor } from '@mui/material';
import {
  BuildConfigShell,
  SourceConfigSection,
  TileEmitConfigSection,
} from '@hierarchidb/ui-accordion-config';
import { GeometryConfigSection } from './GeometryConfigSection.js';
import { ZoomBandConfigSection } from './ZoomBandConfigSection.js';
import { CacheManagementSection } from './CacheManagementSection.tsx';
import { SourceInvalidGeometryFilterCard } from './SourceInvalidGeometryFilterCard.tsx';
import { useShapeBuildConfigStep } from './useShapeBuildConfigStep.js';
import { useHeapPressureMonitor } from '@hierarchidb/ui-memory';
import { useTranslation } from '~/ui/i18n';
import type { ShapeDialogStepProps } from '~/ui/components/ShapeDialogStepProps';
import type { NodeId } from '@hierarchidb/core-types';
import { useSourceConfigSection } from '~/ui/hooks/useSourceConfigSection';
import {
  filteringHighUrl,
  filteringLowUrl,
  filteringMediumUrl,
} from '~/ui/assets/filtering-samples/filteringSamples';
import { useDialogContext } from '@hierarchidb/ui-dialog';
import {
  composeRuntimeBuildConfig,
  DEFAULT_PROCESSING_CONFIG,
  applyBuildConfigPatch,
  mergeProcessingConfig,
  type ShapeBuildConfig,
  type ShapeEntity,
  type ShapeRuntimeBuildConfig,
} from '~/common/types/index';
import { shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';

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
  if (partial.cleanupConfig) {
    next.cleanupConfig = partial.cleanupConfig;
  }
  return next;
};

/**
 * Processing configuration step for Shape plugin.
 */
const ShapeBuildConfigContent: React.FC<ShapeDialogStepProps> = ({
  data,
  nodeId,
  onChange,
  disabled,
}) => {
  const { registerStepDraftCommitter } = useDialogContext<Partial<ShapeEntity>>();
  const { t } = useTranslation();
  const { config } = useShapeBuildConfigStep({ data, onChange });
  const [workingConfig, setWorkingConfig] = useState<ShapeBuildConfig>(config);
  const workingConfigRef = useRef(config);
  const syncedConfigRef = useRef(config);
  const areBuildConfigEqual = useCallback((left: ShapeBuildConfig, right: ShapeBuildConfig): boolean => {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return left === right;
    }
  }, []);
  useEffect(() => {
    if (areBuildConfigEqual(config, syncedConfigRef.current)) return;
    syncedConfigRef.current = config;
    workingConfigRef.current = config;
    setWorkingConfig(config);
  }, [areBuildConfigEqual, config]);
  useEffect(() => {
    workingConfigRef.current = workingConfig;
  }, [workingConfig]);
  const processingConfig = useMemo(
    () => mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, data?.processingConfig),
    [data?.processingConfig]
  );
  const runtimeBuildConfig = useMemo(
    () => composeRuntimeBuildConfig(workingConfig, processingConfig),
    [workingConfig, processingConfig]
  );
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
  const filteringPreviewImages = useMemo(
    () => ({
      weak: filteringLowUrl,
      medium: filteringMediumUrl,
      strong: filteringHighUrl,
    }),
    []
  );
  const updateWorkingConfig = useCallback((next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => {
    setWorkingConfig((prevConfig) => {
      const nextConfig = typeof next === 'function' ? next(prevConfig) : next;
      if (areBuildConfigEqual(prevConfig, nextConfig)) {
        return prevConfig;
      }
      return nextConfig;
    });
  }, [areBuildConfigEqual]);
  const updateRuntimeBuildConfig = useCallback(
    (partial: Partial<ShapeRuntimeBuildConfig>) => {
      updateWorkingConfig((prevConfig) => applyBuildConfigPatch(prevConfig, toBuildConfigUpdate(partial)));
    },
    [updateWorkingConfig]
  );
  useEffect(() => {
    if (!registerStepDraftCommitter) return;
    const unregister = registerStepDraftCommitter(() => ({ buildConfig: workingConfigRef.current }));
    return unregister;
  }, [registerStepDraftCommitter]);

  const fetchState = useSourceConfigSection({
    config: workingConfig,
    nodeId: nodeId as NodeId,
    disabled,
    onChange: updateWorkingConfig,
  });

  return (
    <BuildConfigShell
      padding={2}
      spacing={2}
      sx={{
        '& .MuiCard-root:hover': {
          transform: 'none !important',
          boxShadow: 'none !important',
          transition: 'none !important',
        },
        '& .MuiPaper-root:hover': {
          transform: 'none !important',
          boxShadow: 'none !important',
          transition: 'none !important',
        },
      }}
      alert={
        heapWarning ? (
          <Alert severity={heapWarning.severity} sx={{ alignItems: 'center' }}>
            {heapWarning.message}
          </Alert>
        ) : null
      }
    >
      <ZoomBandConfigSection
        config={workingConfig}
        onChange={updateWorkingConfig}
        disabled={disabled}
        disableHoverLift
      />
      <SourceConfigSection
        t={t}
        buildConfig={runtimeBuildConfig}
        update={updateRuntimeBuildConfig}
        filteringPreviewImages={filteringPreviewImages}
        showConcurrencyCard={false}
        showRetryCard={false}
        disabled={disabled}
        disableHoverLift
        additionalCards={
          <SourceInvalidGeometryFilterCard
            config={workingConfig}
            onChange={updateWorkingConfig}
            disabled={disabled}
            disableHoverLift
          />
        }
      />
      <GeometryConfigSection
        config={workingConfig}
        onChange={updateWorkingConfig}
        disabled={disabled}
        disableHoverLift
      />
      <TileEmitConfigSection
        t={t}
        buildConfig={runtimeBuildConfig}
        update={updateRuntimeBuildConfig}
        showConcurrencyCard={false}
        disabled={disabled}
        disableHoverLift
      />
      <CacheManagementSection
        config={workingConfig}
        onChange={updateWorkingConfig}
        fetchState={fetchState}
        disabled={disabled}
        disableHoverLift
      />
    </BuildConfigShell>
  );
};

const ShapeBuildConfigRunningNotice: React.FC = () => {
  const { t } = useTranslation();
  const { stepComponents, onStepNavigate } = useDialogContext<Partial<ShapeEntity>>();
  const buildStepIndex = useMemo(
    () => stepComponents.findIndex((step) => step.id === 'build'),
    [stepComponents]
  );
  const handleOpenBuildStep = useCallback(() => {
    if (buildStepIndex < 0) return;
    onStepNavigate({ type: 'direct', targetIndex: buildStepIndex });
  }, [buildStepIndex, onStepNavigate]);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="subtitle1">
        {t('processing.buildRunning.title', 'Build is running')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t(
          'processing.buildRunning.body',
          'A build session is currently running. Open the Build step to view progress.'
        )}
      </Typography>
      <Button variant="contained" onClick={handleOpenBuildStep} disabled={buildStepIndex < 0}>
        {t('processing.buildRunning.action', 'Open Build Step')}
      </Button>
    </Stack>
  );
};

export const ShapeBuildConfigStep: React.FC<ShapeDialogStepProps> = (props) => {
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  useEffect(() => {
    const nodeId = props.nodeId as NodeId | undefined;
    if (!nodeId) {
      setSessionStatus(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const session = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId).catch(() => null);
      if (cancelled) return;
      setSessionStatus(session?.status ?? null);
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [props.nodeId]);
  const isBuildRunning = sessionStatus === 'running';
  if (isBuildRunning) {
    return <ShapeBuildConfigRunningNotice />;
  }
  return <ShapeBuildConfigContent {...props} />;
};
