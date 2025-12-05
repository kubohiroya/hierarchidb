import type React from 'react';
import { Box, Typography } from '@mui/material';
import type { StepProps } from '../../../common/shared/index.js';

/**
 * Legacy placeholder: Basic info (name/description/tags) is now handled by TreeNode metadata
 * in the dialog host. This step intentionally renders a notice only.
 */
export const Step1BasicInfo: React.FC<StepProps> = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Basic Information
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Name/description are managed by the host BasicInfo step (TreeNode metadata).
      </Typography>
    </Box>
  );
};
