/**
 * TreeConsolePanelWithDynamicSpeedDial
 *
 * A wrapper component that combines TreeConsolePanel with DynamicSpeedDial
 * to replace hardcoded plugin actions with dynamic plugin loading.
 */

import { Box } from '@mui/material';
import { TreeConsolePanel, type TreeConsolePanelProps } from '@hierarchidb/13-ui-treeconsole-base';
import { DynamicSpeedDial } from './DynamicSpeedDial';
import { WorkerAPIClient } from '@hierarchidb/10-ui-client';
import type { TreeId } from '@hierarchidb/00-core';

interface TreeConsolePanelWithDynamicSpeedDialProps extends TreeConsolePanelProps {
  treeId: TreeId | undefined;
  workerClient: WorkerAPIClient | null;
}

export function TreeConsolePanelWithDynamicSpeedDial({
  treeId,
  workerClient,
  ...panelProps
}: TreeConsolePanelWithDynamicSpeedDialProps) {
  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
      {/* TreeConsolePanel without SpeedDial (we'll add our own) */}
      <TreeConsolePanel {...panelProps} />
      
      {/* Our dynamic SpeedDial that replaces the hardcoded one */}
      <DynamicSpeedDial
        treeId={treeId}
        workerClient={workerClient}
        onCreateAction={panelProps.onContextMenuAction}
        position={{ bottom: 16, right: 16 }}
        hidden={!panelProps.canCreate}
      />
    </Box>
  );
}