/**
 * Simple TreeConsole Demo
 * Tests TreeConsole with WorkerAPIClient.getSingleton()
 */

import { useState, useEffect } from 'react';
import { Container, Typography, Alert, CircularProgress, Box } from '@mui/material';
import { TreeConsole } from '@hierarchidb/ui-treeconsole';
import { WorkerAPIClient } from '@hierarchidb/ui-client';
import type { TreeNodeId } from '@hierarchidb/core';

export default function TreeConsoleSimple() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workerClient, setWorkerClient] = useState<WorkerAPIClient | null>(null);

  useEffect(() => {
    let mounted = true;

    const initWorker = async () => {
      try {
        console.log('Initializing WorkerAPIClient...');
        const client = await WorkerAPIClient.getSingleton();
        
        if (mounted) {
          setWorkerClient(client);
          setLoading(false);
          console.log('WorkerAPIClient initialized successfully');
        }
      } catch (err) {
        console.error('Failed to initialize WorkerAPIClient:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    };

    initWorker();

    return () => {
      mounted = false;
    };
  }, []);

  const handleNodeClick = (nodeId: TreeNodeId) => {
    console.log('Node clicked:', nodeId);
  };

  const handleActionRequest = (action: string, nodeId: TreeNodeId) => {
    console.log('Action requested:', action, 'for node:', nodeId);
  };

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">
          <Typography variant="h6">Failed to initialize Worker</Typography>
          <Typography>{error}</Typography>
        </Alert>
      </Container>
    );
  }

  if (!workerClient) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="warning">
          <Typography>Worker client not available</Typography>
        </Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h5">TreeConsole Simple Demo</Typography>
        <Typography variant="body2" color="text.secondary">
          Testing TreeConsole with WorkerAPIClient.getSingleton()
        </Typography>
      </Box>
      
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <TreeConsole
          rootNodeId="root"
          workerClient={workerClient}
          onNodeClick={handleNodeClick}
          onActionRequest={handleActionRequest}
        />
      </Box>
    </Box>
  );
}