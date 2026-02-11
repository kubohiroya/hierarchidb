import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import type { AlertColor } from '@mui/material';
import { BuildConfigShell, FetchConfigSection, VTConfigSection } from '@hierarchidb/ui-accordion-config';
import { TransformConfigSection } from './TransformConfigSection.js';
import { ZoomBandConfigSection } from './ZoomBandConfigSection.js';
import { CacheManagementSection } from './CacheManagementSection.tsx';
import { useShapeBuildConfigStep } from './useShapeBuildConfigStep.js';
import { useHeapPressureMonitor } from '@hierarchidb/ui-memory';
import { useTranslation } from '../../i18n.js';
import type { ShapeDialogStepProps } from '../ShapeDialogStepProps.tsx';
import type { NodeId } from '@hierarchidb/core-types';
import { useFetchConfigSection } from './useFetchConfigSection.ts';
import {
  filteringHighUrl,
  filteringLowUrl,
  filteringMediumUrl,
} from '../../assets/filtering-samples/filteringSamples.ts';
import { useVTConfigSection } from './useVTConfigSection.ts';
import { useDialogContext } from '@hierarchidb/ui-dialog';
import type { ShapeEntity } from '../../../common/types/index.js';
import { shapeQueryAPIImpl } from '../../../services/batch/ShapeBuildAPIClient.ts';

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
        },
      ),
    };
  }, [heapPressure, t]);
  const filteringPreviewImages = useMemo(() => ({
    weak: filteringLowUrl,
    medium: filteringMediumUrl,
    strong: filteringHighUrl,
  }), []);
  const { update: updateVTConfig } = useVTConfigSection({ buildConfig: config, onChange: handleChange });
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
      alert={heapWarning ? (
        <Alert severity={heapWarning.severity} sx={{ alignItems: 'center' }}>
          {heapWarning.message}
        </Alert>
      ) : null}
    >
      <ZoomBandConfigSection
        config={config}
        onChange={handleChange}
        disabled={disabled}
      />
      <FetchConfigSection
        t={t}
        buildConfig={config}
        update={fetchState.update}
        filteringPreviewImages={filteringPreviewImages}
        disabled={disabled}
      />
      <TransformConfigSection config={config} onChange={handleChange} disabled={disabled} />
      <VTConfigSection t={t} buildConfig={config} update={updateVTConfig} disabled={disabled} />
      <CacheManagementSection config={config} fetchState={fetchState} disabled={disabled} />
    </BuildConfigShell>
  );
};

const ShapeBuildConfigRunningNotice: React.FC = () => {
  const { t } = useTranslation();
  const { stepComponents, onStepNavigate } = useDialogContext<Partial<ShapeEntity>>();
  const buildStepIndex = useMemo(() => (
    stepComponents.findIndex((step) => step.id === 'build')
  ), [stepComponents]);
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
          'A build session is currently running. Open the Build step to view progress.',
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
