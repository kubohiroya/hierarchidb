/**
 * @file PluginUsageExample.tsx
 * @description Example of how to use BaseMap plugin in the application
 */

import React, { useState } from 'react';
import { Button, Box, Typography } from '@mui/material';
import { BaseMapStepperDialog } from '../components/BaseMapStepperDialog';
import type { BaseMapEntity } from '../types';
import type { NodeId } from '@hierarchidb/common-core';

/**
 * Example component showing how to use BaseMap plugin
 */
export const PluginUsageExample: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savedEntity, setSavedEntity] = useState<Partial<BaseMapEntity> | null>(null);

  const handleCreateMap = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleSaveMap = (data: Partial<BaseMapEntity>) => {
    console.log('Saving BaseMap:', data);
    setSavedEntity(data);
    setDialogOpen(false);

    // In a real application, this would call the plugin API:
    // await pluginAPI.createEntity(nodeId, data);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        BaseMap Plugin Example
      </Typography>

      <Typography variant="body1" paragraph>
        This example demonstrates how to integrate the BaseMap plugin into your application. Click
        the button below to open the BaseMap creation dialog.
      </Typography>

      <Button variant="contained" color="primary" onClick={handleCreateMap} sx={{ mb: 3 }}>
        Create Base Map
      </Button>

      {savedEntity && (
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>
            Last Created Map:
          </Typography>
          <pre style={{ fontSize: '0.875rem', overflow: 'auto' }}>
            {JSON.stringify(savedEntity, null, 2)}
          </pre>
        </Box>
      )}

      <BaseMapStepperDialog
        open={dialogOpen}
        nodeId={'example-node-id' as NodeId}
        onClose={handleCloseDialog}
        onSave={handleSaveMap}
        mode="create"
      />
    </Box>
  );
};

/**
 * Plugin integration helper
 * This shows how the plugin would be registered and used
 */
export const registerBaseMapPlugin = () => {
  // In a real application, this would be called during _app initialization
  console.log('Registering BaseMap plugin...');

  // Example of how plugin would be registered:
  // const pluginRegistry = PluginRegistry.getInstance();
  // pluginRegistry.register(basemapPlugin);

  return {
    pluginId: 'com.example.basemap',
    nodeType: 'basemap',
    dialogComponent: BaseMapStepperDialog,
  };
};

export default PluginUsageExample;
