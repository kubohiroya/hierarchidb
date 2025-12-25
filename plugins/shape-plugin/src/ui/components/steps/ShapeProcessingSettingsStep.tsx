import type React from 'react';
import { Box, Stack } from '@mui/material';
import { DownloadConfigSection } from './DownloadConfigSection.js';
import { SimplificationConfigSection } from './SimplificationConfigSection.js';
import { TileConfigSection } from './TileConfigSection.js';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { useShapeProcessingSettingsStep } from '../../hooks/useShapeProcessingSettingsStep.js';

/**
 * Processing configuration step for Shape plugin.
 */
export const ShapeProcessingSettingsStep: React.FC<ShapeDialogStepProps> = ({ data, onChange }) => {
  const { config, handleChange } = useShapeProcessingSettingsStep({ data, onChange });
  const resetSession = () => {
    onChange({ batchSessionId: undefined, processingStatus: 'idle' });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <DownloadConfigSection
          config={config}
          draft={data}
          onChange={handleChange}
          onResetSession={resetSession}
        />
        <SimplificationConfigSection config={config} onChange={handleChange} />
        <TileConfigSection config={config} onChange={handleChange} />
      </Stack>
    </Box>
  );
};
