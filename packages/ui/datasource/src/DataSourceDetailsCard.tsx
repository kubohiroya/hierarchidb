import type React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

export interface DataSourceDetailsCardProps {
  title?: string;
  children?: React.ReactNode;
}

export const DataSourceDetailsCard: React.FC<DataSourceDetailsCardProps> = ({
  title = 'Details',
  children,
}) => (
  <Card variant="outlined">
    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {title ? <Typography variant="subtitle1">{title}</Typography> : null}
      {children}
    </CardContent>
  </Card>
);
