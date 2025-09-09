/**
 * Worker Test Page
 *
 * Simple test to verify WorkerAPIClient can be initialized
 */

import { useState } from 'react';
import { Alert, Box, Button, Container, Typography } from '@mui/material';
import { WorkerAPIClient } from '../WorkerAPIClient';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';

export default function WorkerTest() {
  const [status, setStatus] = useState<string>('Not started');
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<Remote<WorkerAPI> | null>(null);

  const testWorker = async () => {
    setStatus('Initializing...');
    setError(null);

    try {
      // Step 1: Test WorkerAPIClient.getSingleton
      setStatus('Getting WorkerAPIClient singleton...');
      const client = await WorkerAPIClient.getSingleton();
      console.log('WorkerAPIClient obtained:', client);

      // Step 2: Use client directly (no getAPI needed)
      setStatus('Using client directly...');
      const api = client;
      console.log('API obtained:', api);
      console.log('API methods:', Object.getOwnPropertyNames(api));

      // Step 3: Test listTrees via QueryAPI
      setStatus('Getting QueryAPI and testing listTrees...');
      const queryAPI = await api.getQueryAPI();
      const trees = await queryAPI.listTrees();
      console.log('listTrees result:', trees);

      // Step 4: Test system health
      setStatus('Testing system health...');
      if (typeof api.getSystemHealth === 'function') {
        const health = await api.getSystemHealth();
        console.log('System health:', health);
      }

      setStatus(`Success! Found ${trees?.length || 0} trees`);
      setClient(client);
    } catch (err) {
      console.error('Worker test failed:', err);
      console.error('Error stack:', (err as Error)?.stack);
      setError(
        err instanceof Error
          ? `${err.message}

Stack: ${err.stack}`
          : String(err),
      );
      setStatus('Failed');
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Worker Test
      </Typography>

      <Box sx={{ my: 3 }}>
        <Button variant="contained" onClick={testWorker} disabled={status === 'Initializing...'}>
          Test Worker Connection
        </Button>
      </Box>

      <Box sx={{ my: 2 }}>
        <Typography variant="h6">Status:</Typography>
        <Typography
          color={error ? 'error' : status.includes('Success') ? 'success.main' : 'text.primary'}
        >
          {status}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="h6">Error:</Typography>
          <Typography>{error}</Typography>
        </Alert>
      )}

      {client && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography>WorkerAPIClient instance created successfully!</Typography>
        </Alert>
      )}

      <Box sx={{ mt: 4, p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
        <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace' }}>
          {`// Debug Info
Status: ${status}
Error: ${error || 'None'}
Client: ${client ? 'Created' : 'Not created'}
Time: ${new Date().toLocaleTimeString()}`}
        </Typography>
      </Box>
    </Container>
  );
}
