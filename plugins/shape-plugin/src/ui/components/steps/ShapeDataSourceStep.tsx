import type React from 'react';
import { Box, Typography } from '@mui/material';
import { DataSourceWithLicense } from '@hierarchidb/ui-datasource';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { useShapeDataSourceStep } from '../../hooks/useShapeDataSourceStep.js';


/**
 * Data Source Selection step for Shape plugin
 */
export const ShapeDataSourceStep: React.FC<ShapeDialogStepProps> = ({ data, onChange }) => {
  const draftData = data ?? {};
  const { options, dataSourceId, handleChange } = useShapeDataSourceStep({ data: draftData, onChange });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Select Data Source
      </Typography>

      <Box sx={{ mt: 3 }}>
        <DataSourceWithLicense<string>
          options={options}
          state={{
            dataSourceId,
            licenseAgreement: Boolean(draftData.licenseAgreement),
            licenseAgreedAt: draftData.licenseAgreedAt,
          }}
          onChange={handleChange}
          licenseRequired={false}
          description={
            <Typography variant="body2" color="text.secondary" paragraph>
              Choose a geographic data provider. Each source has different coverage, accuracy, and
              licensing requirements.
            </Typography>
          }
          createAgreedAt={() => new Date().toISOString()}
        />
      </Box>
    </Box>
  );
};
