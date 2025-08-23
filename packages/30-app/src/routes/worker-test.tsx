/**
 * Worker Test Page
 *
 * Simple test to verify WorkerAPIClient can be initialized
 */

import { useState } from "react";
import { Box, Container, Typography, Alert, Button } from "@mui/material";
import { WorkerAPIClient } from "@hierarchidb/10-ui-client";

export default function WorkerTest() {
  const [status, setStatus] = useState<string>("Not started");
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<WorkerAPIClient | null>(null);

  const testWorker = async () => {
    setStatus("Initializing...");
    setError(null);

    try {
      // Step 1: Get singleton
      setStatus("Getting WorkerAPIClient singleton...");
      const workerClient = await WorkerAPIClient.getSingleton();
      setClient(workerClient);

      // Step 2: Test ping
      setStatus("Testing ping...");
      await workerClient.ping();

      // Step 3: Get API
      setStatus("Getting API...");
      const api = workerClient.getAPI();

      // Step 4: Test a simple API call
      setStatus("Testing API call (getTrees)...");
      const trees = await api.getTrees();

      setStatus(`Success! Found ${trees?.length || 0} trees`);
    } catch (err) {
      console.error("Worker test failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus("Failed");
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Worker Test
      </Typography>

      <Box sx={{ my: 3 }}>
        <Button
          variant="contained"
          onClick={testWorker}
          disabled={status === "Initializing..."}
        >
          Test Worker Connection
        </Button>
      </Box>

      <Box sx={{ my: 2 }}>
        <Typography variant="h6">Status:</Typography>
        <Typography
          color={
            error
              ? "error"
              : status.includes("Success")
                ? "success.main"
                : "text.primary"
          }
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
          <Typography>
            WorkerAPIClient instance created successfully!
          </Typography>
        </Alert>
      )}

      <Box sx={{ mt: 4, p: 2, backgroundColor: "grey.100", borderRadius: 1 }}>
        <Typography
          variant="caption"
          component="pre"
          sx={{ fontFamily: "monospace" }}
        >
          {`// Debug Info
Status: ${status}
Error: ${error || "None"}
Client: ${client ? "Created" : "Not created"}
Time: ${new Date().toLocaleTimeString()}`}
        </Typography>
      </Box>
    </Container>
  );
}
