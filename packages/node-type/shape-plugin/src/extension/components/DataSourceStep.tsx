/**
 * @file DataSourceStep.tsx
 * @description Data Source step wrapper for Shape extension base-dialog
 *
 * This component adapts the existing Step2DataSource component to work
 * with the plugin extension base-dialog interface.
 */

import React from 'react';
import { Box, Button } from '@mui/material';
import { Step2DataSource } from '../../components/steps/Step2DataSource';

export interface DataSourceStepProps {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
}

export const DataSourceStep: React.FC<DataSourceStepProps> = ({
                                                                data,
                                                                onNext,
                                                                onPrevious,
                                                                errors,
                                                              }) => {
  /*
  const handleDataSourceChange = (dataSourceName: string) => {
    const updatedData = { ...data, dataSourceName };
    onNext(updatedData);
  };
   */

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1 }}>
        <Step2DataSource
          workingCopy={{ ...data, dataSourceName: data.dataSourceName }}
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
        <Button variant="contained" onClick={() => onNext(data)} disabled={!data.dataSourceName}>
          Next
        </Button>
      </Box>
    </Box>
  );
};
