import type React from 'react';
import { Box, Typography } from '@mui/material';
import { DataSourceSelector } from './DataSourceSelector.js';
import type { DataSourceName, DataSourceCategory } from './types/DataSource.js';

export interface DataSourceSelectionStepProps {
  selectedDataSource?: DataSourceName;
  onDataSourceChange: (dataSource: DataSourceName) => void;
  filterByCategory?: DataSourceCategory;
  showDescription?: boolean;
  gridColumns?: number;
}

export const DataSourceSelectionStep: React.FC<DataSourceSelectionStepProps> = ({
  selectedDataSource,
  onDataSourceChange,
  filterByCategory: _filterByCategory,
  showDescription = true,
  gridColumns: _gridColumns = 2,
}) => {
  // Build options from configs lazily to keep this component UI-level
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Select Data Source
      </Typography>
      {showDescription && (
        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
          Choose a geographic data source for your shapes. Each data source has different
          licensing terms, coverage areas, and data quality characteristics.
        </Typography>
      )}

      {/* Minimal wrapper: delegate selection UX to DataSourceSelector from this package */}
      <DataSourceSelector
        options={[]}
        // This simple UI package’s selector expects generic options; consumers may pass richer options.
        value={selectedDataSource || ''}
        onChange={(v) => onDataSourceChange(v as DataSourceName)}
      />
    </Box>
  );
};
