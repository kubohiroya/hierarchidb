import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import type { AlertColor } from '@mui/material';
import {
  BuildConfigShell,
  FetchConfigSection,
  VTConfigSection,
} from '@hierarchidb/ui-accordion-config';
import { TransformConfigSection } from './TransformConfigSection.js';
import { ZoomBandConfigSection } from './ZoomBandConfigSection.js';
import { CacheManagementSection } from './CacheManagementSection.tsx';
import { FetchInvalidGeometryFilterCard } from './FetchInvalidGeometryFilterCard.tsx';
import { useShapeBuildConfigStep } from './useShapeBuildConfigStep.js';
import { useHeapPressureMonitor } from '@hierarchidb/ui-memory';
import { useTranslation } from '~/ui/i18n';
import type { ShapeDialogStepProps } from '~/ui/components/ShapeDialogStepProps';
import type { NodeId } from '@hierarchidb/core-types';
import { useFetchConfigSection } from '~/ui/hooks/useFetchConfigSection';
import {
  filteringHighUrl,
  filteringLowUrl,
  filteringMediumUrl,
} from '~/ui/assets/filtering-samples/filteringSamples';
import { useDialogContext } from '@hierarchidb/ui-dialog';
import {
  composeRuntimeBuildConfig,
  DEFAULT_PROCESSING_CONFIG,
  mergeBuildConfig,
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
  if (partial.fetchConfig) {
    const {
      maxConcurrent: _ignoredConcurrency,
      retryAttempts: _ignoredRetryAttempts,
      retryDelay: _ignoredRetryDelay,
      retryLimit: _ignoredRetryLimit,
      retryBackoff: _ignoredRetryBackoff,
      ...fetchConfig
    } = partial.fetchConfig;
    next.fetchConfig = fetchConfig;
  }
  if (partial.transformConfig) {
    const { maxConcurrent: _ignoredConcurrency, ...transformConfig } = partial.transformConfig;
    next.transformConfig = transformConfig;
  }
  if (partial.vtConfig) {
    const {
      maxConcurrent: _ignoredConcurrency,
      dynamicConcurrency: _ignoredDynamicConcurrency,
      ...vtConfig
    } = partial.vtConfig;
    next.vtConfig = vtConfig;
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
  const { t } = useTranslation();
  const { config, handleChange } = useShapeBuildConfigStep({ data, onChange });
  const processingConfig = useMemo(
    () => mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, data?.processingConfig),
    [data?.processingConfig]
  );
  const runtimeBuildConfig = useMemo(
    () => composeRuntimeBuildConfig(config, processingConfig),
    [config, processingConfig]
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
  const updateRuntimeBuildConfig = useCallback(
    (partial: Partial<ShapeRuntimeBuildConfig>) => {
      const nextBuildConfig = mergeBuildConfig(config, toBuildConfigUpdate(partial));
      handleChange(nextBuildConfig);
    },
    [config, handleChange]
  );
  const fetchState = useFetchConfigSection({
    config,
    nodeId: nodeId as NodeId,
    disabled,
    onChange: handleChange,
  });

  return (
    <BuildConfigShell
      padding={2}
      spacing={2}
      alert={
        heapWarning ? (
          <Alert severity={heapWarning.severity} sx={{ alignItems: 'center' }}>
            {heapWarning.message}
          </Alert>
        ) : null
      }
    >
      <ZoomBandConfigSection config={config} onChange={handleChange} disabled={disabled} />
      <FetchConfigSection
        t={t}
        buildConfig={runtimeBuildConfig}
        update={updateRuntimeBuildConfig}
        filteringPreviewImages={filteringPreviewImages}
        showConcurrencyCard={false}
        showRetryCard={false}
        disabled={disabled}
        additionalCards={
          <FetchInvalidGeometryFilterCard
            config={config}
            onChange={handleChange}
            disabled={disabled}
          />
        }
      />
      <TransformConfigSection config={config} onChange={handleChange} disabled={disabled} />
      <VTConfigSection
        t={t}
        buildConfig={runtimeBuildConfig}
        update={updateRuntimeBuildConfig}
        showConcurrencyCard={false}
        disabled={disabled}
      />
      <CacheManagementSection
        config={config}
        onChange={handleChange}
        fetchState={fetchState}
        disabled={disabled}
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
