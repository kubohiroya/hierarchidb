import type React from 'react';
import { useMemo } from 'react';
import { Alert, Box, Stack } from '@mui/material';
import type { AlertColor } from '@mui/material';
import { FetchConfigSection } from './FetchConfigSection.tsx';
import { TransformByBandConfigSection } from './TransformByBandConfigSection.js';
import { TransformByZoomConfigSection } from './TransformByZoomConfigSection.js';
import { VTConfigSection } from './VTConfigSection.tsx';
import { useShapeBuildConfigStep } from './useShapeBuildConfigStep.js';
import { useHeapPressureMonitor } from '@hierarchidb/ui-memory';
import { useTranslation } from '../../i18n.js';
import type { ShapeDialogStepProps } from '../ShapeDialogStepProps.tsx';
import type { NodeId } from '@hierarchidb/common-types';

/**
 * Processing configuration step for Shape plugin.
 */
export const ShapeBuildConfigStep: React.FC<ShapeDialogStepProps> = ({ data, nodeId, onChange }) => {
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

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        {heapWarning ? (
          <Alert severity={heapWarning.severity} sx={{ alignItems: 'center' }}>
            {heapWarning.message}
          </Alert>
        ) : null}
        <FetchConfigSection
          config={config}
          draft={data}
          nodeId={nodeId as NodeId}
          onChange={handleChange}
          onResetSession={resetSession}
        />
        <TransformByBandConfigSection config={config} onChange={handleChange} />
        <TransformByZoomConfigSection config={config} onChange={handleChange} />
        <VTConfigSection buildConfig={config} draft={data} onChange={handleChange} />
      </Stack>
    </Box>
  );
};
