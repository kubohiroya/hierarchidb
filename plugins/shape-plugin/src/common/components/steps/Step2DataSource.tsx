import type React from 'react';
import { Box, Typography } from '@mui/material';
import { DataSourceSelector, type DataSourceOption } from '@hierarchidb/ui-datasource';
import {
  normalizeDataSourceName,
  type DataSourceConfig,
  type DataSourceName,
  type StepProps,
} from '../../shared/index.js';
import { DATA_SOURCE_CONFIGS } from '../../mock/data.js';

/**
 * Step 2: Data Source Selection
 * Uses @hierarchidb/_app-datasource components for data source selection
 */
export const Step2DataSource: React.FC<StepProps> = ({ draft, onUpdate, disabled }) => {
  const sources = Object.values(DATA_SOURCE_CONFIGS) as DataSourceConfig[];
  const options: DataSourceOption[] = sources.map((source) => ({
    id: source.name,
    name: source.displayName,
    description: source.description,
    icon: source.icon,
    metadata: {
      license: source.license,
      licenseUrl: source.licenseUrl,
      attribution: source.attribution,
    },
  }));

  const handleDataSourceSelect = (dataSourceName: DataSourceName) => {
    onUpdate({
      dataSourceName,
      licenseAgreement: false, // Reset license agreement when changing source
      licenseAgreedAt: undefined,
    });
  };

  const normalizedValue = normalizeDataSourceName(draft.dataSourceName);
  const defaultGeoBoundaries = options.find((option) => option.id === 'geoboundaries')?.id;
  const fallbackValue = defaultGeoBoundaries ?? options[0]?.id ?? '';

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Select Data Source
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Choose a geographic data provider. Each source has different coverage, accuracy, and
        licensing requirements.
      </Typography>

      <Box sx={{ mt: 3 }}>
        <DataSourceSelector
          options={options}
          value={normalizedValue ?? fallbackValue}
          onChange={(next) => handleDataSourceSelect(next as DataSourceName)}
          disabled={disabled}
        />
      </Box>
    </Box>
  );
};
