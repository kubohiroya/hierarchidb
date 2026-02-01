import type React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { DataSourceSelector } from './DataSourceSelector.js';
import type { DataSourceSelectorProps } from './DataSourceSelector.js';

export interface DataSourceSelectionCardProps extends DataSourceSelectorProps {
  title?: React.ReactNode;
}

export const DataSourceSelectionCard: React.FC<DataSourceSelectionCardProps> = ({
  title,
  ...props
}) => (
  <Card variant="outlined">
    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {title ? (
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
      ) : null}
      <DataSourceSelector {...props} />
    </CardContent>
  </Card>
);
