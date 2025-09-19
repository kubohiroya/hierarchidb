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

export interface ProcessingStepProps {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
}

export const ProcessingStep: React.FC<ProcessingStepProps> = ({
                                                                data,
                                                                onNext,
                                                                onPrevious,
                                                                errors,
                                                              }) => {
  const wc = (data || {}) as any;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1 }}>
        <Step4Processing
          workingCopy={{
            ...wc,
            selectedAdminLevels: wc.selectedAdminLevels || [],
            batchConfig: wc.batchConfig,
          }}
          onUpdate={(updates) => {
            const updatedData = { ...wc, ...updates };
            onNext(updatedData);
          }}
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
        <Button
          variant="contained"
          onClick={() => onNext(wc)}
          disabled={!wc.selectedAdminLevels || wc.selectedAdminLevels.length === 0}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
};
