/**
 * @file BaseMapAnalytics.tsx
 * @description Analytics component for BaseMap usage and performance
 */

import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import type { BaseMapEntity } from '../types';
import type { NodeId } from '@hierarchidb/common-core';

export interface BaseMapAnalyticsProps {
  nodeId: NodeId;
  entity?: BaseMapEntity;
}

export const BaseMapAnalytics: React.FC<BaseMapAnalyticsProps> = ({
  nodeId,
  entity,
}) => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Map Analytics
      </Typography>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Map Information
        </Typography>
        {entity ? (
          <>
            <Typography variant="body2">
              <strong>Node ID:</strong> {nodeId}
            </Typography>
            <Typography variant="body2">
              <strong>Map Style:</strong> {entity.mapStyle}
            </Typography>
            <Typography variant="body2">
              <strong>Center:</strong> [{entity.center[0]}, {entity.center[1]}]
            </Typography>
            <Typography variant="body2">
              <strong>Zoom Level:</strong> {entity.zoom}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No map entity data available
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Performance Metrics
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Advanced analytics features will be available soon.
        </Typography>
      </Paper>
    </Box>
  );
};

export default BaseMapAnalytics;