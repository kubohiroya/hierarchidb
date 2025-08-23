import React from 'react';
import { Box, Typography } from '@mui/material';
import { DataSourceSelector } from './DataSourceSelector';
import { DataSourceName, DataSourceCategory } from '../types/DataSource';

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
  filterByCategory,
  showDescription = true,
  gridColumns = 2,
}) => {
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
      
      <DataSourceSelector
        selectedDataSource={selectedDataSource}
        onDataSourceChange={onDataSourceChange}
        category={filterByCategory}
        layout={{ columns: gridColumns as 1 | 2 | 3 | 4 }}
        showDetails={{
          adminLevels: true,
          countryCount: true,
          limitations: true,
          website: true,
        }}
      />
    </Box>
  );
};