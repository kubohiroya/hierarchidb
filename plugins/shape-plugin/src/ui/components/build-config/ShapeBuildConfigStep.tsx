import type React from 'react';
import { useMemo } from 'react';
import { Alert } from '@mui/material';
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

/**
 * Processing configuration step for Shape plugin.
 */
export const ShapeBuildConfigStep: React.FC<ShapeDialogStepProps> = ({
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
  const resetSession = () => {
    onChange({
      processingStatus: 'idle',
      tileSummary: undefined,
      buildStartedAt: undefined,
      buildFinishedAt: undefined,
    });
  };
  const filteringPreviewImages = useMemo(() => ({
    weak: filteringLowUrl,
    medium: filteringMediumUrl,
    strong: filteringHighUrl,
  }), []);
  const { update: updateVTConfig } = useVTConfigSection({ buildConfig: config, onChange: handleChange });
  const fetchState = useFetchConfigSection({
    config,
    draft: data,
    nodeId: nodeId as NodeId,
    disabled,
    onChange: handleChange,
    onResetSession: resetSession,
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
