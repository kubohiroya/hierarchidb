/**
 * @file DataSourceStep.tsx
 * @description Data Source step wrapper for Shape extension base-dialog
 *
 * This component adapts the existing Step2DataSource component to work
 * with the plugin extension base-dialog interface.
 */

import type React from 'react';
import { Box, Button } from '@mui/material';
import { Step2DataSource } from '../../components/steps/Step2DataSource.js';
import type { ShapeWorkingCopy } from '../../shared/index.js';

type ShapeDialogData = Partial<ShapeWorkingCopy> & { selectedAdminLevels?: number[] };

export interface DataSourceStepProps {
  data?: ShapeDialogData | null;
  onNext: (data: ShapeDialogData) => void;
  onPrevious: () => void;
  errors?: string[];
}

export const DataSourceStep: React.FC<DataSourceStepProps> = ({
  data,
  onNext,
  onPrevious,
  errors,
}) => {
  const dialogData: ShapeDialogData =
    typeof data === 'object' && data !== null ? { ...data } : {};

  const handleNextState = (updates: Partial<ShapeWorkingCopy>) => {
    onNext({ ...dialogData, ...updates });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1 }}>
        <Step2DataSource
          workingCopy={dialogData}
          onUpdate={handleNextState}
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
          onClick={() => onNext(dialogData)}
          disabled={!dialogData.dataSourceName}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
};
