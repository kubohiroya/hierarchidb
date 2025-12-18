import type React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../../common/types/index.js';
import type { ProcessingConfig, StepProps } from '../../../common/types/index.js';
import { DownloadConfigSection } from './DownloadConfigSection.js';
import { SimplificationConfigSection } from './SimplificationConfigSection.js';
import { TileConfigSection } from './TileConfigSection.js';
import { CleanupConfigSection } from './CleanupConfigSection.js';

/**
 * Processing configuration step for Shape plugin.
 */
export const ShapeProcessingSettingsStep: React.FC<StepProps> = ({ draft, onUpdate, disabled }) => {
  const config = mergeProcessingConfig(draft?.processingConfig ?? DEFAULT_PROCESSING_CONFIG);

  const handleChange = (nextConfig: ProcessingConfig) => {
    onUpdate({ processingConfig: nextConfig });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Configure Processing Parameters
      </Typography>

      <Stack spacing={2}>
        <DownloadConfigSection config={config} disabled={disabled} onChange={handleChange} />
        <SimplificationConfigSection config={config} disabled={disabled} onChange={handleChange} />
        <TileConfigSection config={config} disabled={disabled} onChange={handleChange} />
        <CleanupConfigSection config={config} disabled={disabled} onChange={handleChange} />
      </Stack>
    </Box>
  );
};
