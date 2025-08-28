import React from 'react';
import { Chip } from '@mui/material';
import type { BatchStatus } from '~/types';

interface BatchStatusChipProps {
  status: BatchStatus;
}

export const BatchStatusChip: React.FC<BatchStatusChipProps> = ({ status }) => {
  const getChipProps = () => {
    switch (status) {
      case 'preparing':
        return { label: 'Preparing', color: 'default' as const };
      case 'downloading':
        return { label: 'Downloading', color: 'info' as const };
      case 'processing':
        return { label: 'Processing', color: 'primary' as const };
      case 'generating':
        return { label: 'Generating Tiles', color: 'secondary' as const };
      case 'completed':
        return { label: 'Completed', color: 'success' as const };
      case 'error':
        return { label: 'Error', color: 'error' as const };
      case 'cancelled':
        return { label: 'Cancelled', color: 'warning' as const };
      default:
        return { label: 'Unknown', color: 'default' as const };
    }
  };

  const props = getChipProps();
  
  return (
    <Chip
      {...props}
      size="small"
      sx={{ fontWeight: 'medium' }}
    />
  );
};