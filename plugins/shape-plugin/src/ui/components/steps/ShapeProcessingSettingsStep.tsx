import type React from 'react';
import { useMemo } from 'react';
import { Alert, Box, Stack } from '@mui/material';
import type { AlertColor } from '@mui/material';
import { DownloadConfigSection } from './DownloadConfigSection.js';
import { Simplify1ConfigSection } from './Simplify1ConfigSection.js';
import { Simplify2ConfigSection } from './Simplify2ConfigSection.js';
import { TileConfigSection } from './TileConfigSection.js';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { useShapeProcessingSettingsStep } from '../../hooks/useShapeProcessingSettingsStep.js';
import { useHeapPressureMonitor } from '@hierarchidb/ui-memory';
import { useTranslation } from '../../i18n.js';

/**
 * Processing configuration step for Shape plugin.
 */
export const ShapeProcessingSettingsStep: React.FC<ShapeDialogStepProps> = ({ data, onChange }) => {
  const { t } = useTranslation();
  const { config, handleChange } = useShapeProcessingSettingsStep({ data, onChange });
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
        <DownloadConfigSection
          config={config}
          draft={data}
          onChange={handleChange}
          onResetSession={resetSession}
        />
        <Simplify1ConfigSection config={config} draft={data} onChange={handleChange} />
        <Simplify2ConfigSection config={config} draft={data} onChange={handleChange} />
        <TileConfigSection config={config} draft={data} onChange={handleChange} />
      </Stack>
    </Box>
  );
};
