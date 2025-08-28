import React from 'react';
import { Box, Typography } from '@mui/material';
// @hierarchidb/_app-datasource パッケージのコンポーネントを活用（想定）
// 実際のimportは、_app-datasourceパッケージの実装に依存
import type { StepProps } from '~/types';
import { DATA_SOURCE_CONFIGS } from '~/mock/data';

/**
 * Step 2: Data Source Selection
 * Uses @hierarchidb/_app-datasource components for data source selection
 */
export const Step2DataSource: React.FC<StepProps> = ({ workingCopy, onUpdate, disabled }) => {
  const handleDataSourceSelect = (dataSourceName: string) => {
    onUpdate({
      dataSourceName: dataSourceName as any,
      licenseAgreement: false, // Reset license agreement when changing source
      licenseAgreedAt: undefined,
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Select Data Source
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Choose a geographic data provider. Each source has different coverage, accuracy, and
        licensing requirements.
      </Typography>

      {/* TODO: Replace with actual DataSourceSelector from @hierarchidb/_app-datasource */}
      <Box sx={{ mt: 3 }}>
        {Object.values(DATA_SOURCE_CONFIGS).map((source) => (
          <Box
            key={source.name}
            sx={{
              p: 2,
              mb: 2,
              border: 2,
              borderColor: workingCopy.dataSourceName === source.name ? 'primary.main' : 'divider',
              borderRadius: 1,
              cursor: disabled ? 'default' : 'pointer',
              bgcolor:
                workingCopy.dataSourceName === source.name ? 'action.selected' : 'background.paper',
              '&:hover': disabled ? {} : { bgcolor: 'action.hover' },
            }}
            onClick={() => !disabled && handleDataSourceSelect(source.name)}
          >
            <Typography variant="subtitle1">
              {source.icon} {source.displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {source.description}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              License: {source.license} | Max Level: {source.maxAdminLevel}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
