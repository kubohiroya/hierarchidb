import type React from 'react';
import { Box, Stack } from '@mui/material';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../../common/types/index.js';
import type { ProcessingConfig } from '../../../common/types/index.js';
import { DownloadConfigSection } from './DownloadConfigSection.js';
import { SimplificationConfigSection } from './SimplificationConfigSection.js';
import { TileConfigSection } from './TileConfigSection.js';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { clearStagesIfPresent, resolveProcessingConfigInvalidation, resolveShapeSessionId } from '../../utils/sessionInvalidation.js';

/**
 * Processing configuration step for Shape plugin.
 */
export const ShapeProcessingSettingsStep: React.FC<ShapeDialogStepProps> = ({ data, onChange }) => {
  const config = mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG);

  const handleChange = (nextConfig: ProcessingConfig) => {
    const previousConfig = mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG);
    const nextMerged = mergeProcessingConfig(nextConfig ?? DEFAULT_PROCESSING_CONFIG);
    const stages = resolveProcessingConfigInvalidation(previousConfig, nextMerged);
    const sessionId = resolveShapeSessionId(data);
    if (sessionId && stages.length > 0) {
      void clearStagesIfPresent(sessionId, stages);
    }
    onChange({ processingConfig: nextMerged });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <DownloadConfigSection config={config} draft={data} onChange={handleChange} />
        <SimplificationConfigSection config={config} onChange={handleChange} />
        <TileConfigSection config={config} onChange={handleChange} />
      </Stack>
    </Box>
  );
};
