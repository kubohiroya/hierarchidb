/**
 * Simple TreeConsole Demo
 * Tests TreeConsole with WorkerAPIClient.getSingleton()
 */

import { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Alert,
  CircularProgress,
  Box,
} from "@mui/material";
import {
  TreeConsolePanel,
  type TreeNodeData,
} from "@hierarchidb/13-ui-treeconsole-base";
import { WorkerAPIClient } from "@hierarchidb/10-ui-client";

export default function TreeConsoleSimple() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workerClient, setWorkerClient] = useState<WorkerAPIClient | null>(
    null,
  );

  useEffect(() => {
    let mounted = true;

    const initWorker = async () => {
      try {
        console.log("Initializing WorkerAPIClient...");
        const client = await WorkerAPIClient.getSingleton();

        if (mounted) {
          setWorkerClient(client);
          setLoading(false);
          console.log("WorkerAPIClient initialized successfully");
        }
      } catch (err) {
        console.error("Failed to initialize WorkerAPIClient:", err);
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

  const handleNodeClick = (node: TreeNodeData) => {
    console.log("Node clicked:", node);
  };

  if (loading) {
    return (
      <Container
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
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
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h5">TreeConsole Simple Demo</Typography>
        <Typography variant="body2" color="text.secondary">
          Testing TreeConsole with WorkerAPIClient.getSingleton()
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: "hidden" }}>
        <TreeConsolePanel
          data={[]}
          columns={[]}
          breadcrumbItems={[]}
          selectedIds={[]}
          expandedIds={[]}
          searchTerm=""
          availableFilters={[]}
          viewMode="list"
          canCreate={false}
          canEdit={false}
          canDelete={false}
          onNodeClick={handleNodeClick}
          onSearchChange={() => {}}
          onSearchClear={() => {}}
          onCreate={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          onRefresh={() => {}}
          onExpandAll={() => {}}
          onCollapseAll={() => {}}
          onSort={() => {}}
          onFilterChange={() => {}}
          onViewModeChange={() => {}}
          onBreadcrumbNavigate={() => {}}
          onContextMenuAction={() => {}}
        />
      </Box>
    </Box>
  );
}
