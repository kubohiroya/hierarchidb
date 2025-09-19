/**
 * @file ProcessingStep.tsx
 * @description Processing step wrapper for Shape extension base-dialog
 *
 * This component adapts the existing Step4Processing component to work
 * with the plugin extension base-dialog interface.
 */

import React from 'react';
import { Box, Button } from '@mui/material';

import { Step4Processing } from '../../components/steps/Step4Processing.js';
import { DEFAULT_PROCESSING_CONFIG } from '../../shared/index.js';
import type { ShapeWorkingCopy } from '../../shared/index.js';

type ShapeDialogData = Partial<ShapeWorkingCopy> & { selectedAdminLevels?: number[] };

export interface ProcessingStepProps {
  data?: ShapeDialogData | null;
  onNext: (data: ShapeDialogData) => void;
  onPrevious: () => void;
  errors?: string[];
}

export const ProcessingStep: React.FC<ProcessingStepProps> = ({ data, onNext, onPrevious, errors }) => {
  const dialogData: ShapeDialogData = typeof data === 'object' && data !== null ? { ...data } : {};
  const workingCopy: ShapeDialogData = {
    ...dialogData,
    processingConfig: dialogData.processingConfig ?? DEFAULT_PROCESSING_CONFIG,
  };

  const handleUpdate = (updates: Partial<ShapeWorkingCopy>) => {
    onNext({ ...dialogData, ...updates });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1 }}>
        <Step4Processing
          workingCopy={workingCopy}
          onUpdate={handleUpdate}
          disabled={false}
        />

        {errors?.map((error, index) => (
          <Box key={index} sx={{ color: 'error.main', mt: 1, fontSize: '0.875rem' }}>
            {error}
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          mt: 3,
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: 1,
          borderColor: 'divider',
          pt: 2,
        }}
      >
        <Button onClick={onPrevious}>Previous</Button>
        <Button variant="contained" onClick={() => onNext(dialogData)}>
          Next
        </Button>
      </Box>
    </Box>
  );
};
