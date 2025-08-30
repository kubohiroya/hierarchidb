/**
 * @file CountrySelectionStep.tsx
 * @description Country Selection step wrapper for Shape extension base-dialog
 *
 * This component adapts the existing Step5CountrySelection component to work
 * with the plugin extension base-dialog interface.
 */

import React from 'react';
import { Box, Button } from '@mui/material';
import { Step5CountrySelection } from '../../components/steps/Step5CountrySelection';

export interface CountrySelectionStepProps {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
}

export const CountrySelectionStep: React.FC<CountrySelectionStepProps> = ({
  data,
  onNext,
  onPrevious,
  errors,
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1 }}>
        <Step5CountrySelection
          workingCopy={{
            ...data,
            selectedCountries: data.selectedCountries || [],
          }}
          onUpdate={(updates) => {
            const updatedData = { ...data, ...updates };
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
          onClick={() => onNext(data)}
          disabled={!data.selectedCountries || data.selectedCountries.length === 0}
        >
          Finish
        </Button>
      </Box>
    </Box>
  );
};
