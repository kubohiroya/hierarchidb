/**
 * Simple TreeConsole Demo
 * Tests TreeConsole with WorkerAPIClient.getSingleton()
 */

import { Alert, Box, CircularProgress, Container, Typography } from '@mui/material';
import { TreeConsolePanel, type TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import { useWorkerAPIClient } from '~/hooks/useWorkerAPIClient.js';

export default function TreeConsoleSimple() {
  // Get the Worker API client
  const workerClientWrapper = useWorkerAPIClient();
  const workerClient = workerClientWrapper?.getAPI();

  const handleNodeClick = (node: TreeNodeData) => {
    console.log('Node clicked:', node);
  };

  if (!workerClient) {
    return (
      <Container
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
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
          onSearchChange={() => {
          }}
          onSearchClear={() => {
          }}
          onCreate={() => {
          }}
          onEdit={() => {
          }}
          onDelete={() => {
          }}
          onRefresh={() => {
          }}
          onExpandAll={() => {
          }}
          onCollapseAll={() => {
          }}
          onSort={() => {
          }}
          onFilterChange={() => {
          }}
          onViewModeChange={() => {
          }}
          onBreadcrumbNavigate={() => {
          }}
          onContextMenuAction={() => {
          }}
        />
      </Box>
    </Box>
  );
}
