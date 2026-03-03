import { type ReactNode } from 'react';
import { Box } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import { BuildSessionLauncherPanel } from '@hierarchidb/ui-build-sessions';
import { toNodeType } from '@hierarchidb/core-types';
import type { ShapeEntity } from '~/common/types/ShapeEntity';

export const ShapeBuildProgressPanelStartIcon = (): ReactNode => (
  <ConstructionIcon fontSize="small" />
);

export const ShapeBuildProgressPanelHeaderIcon = (): ReactNode => (
  <ConstructionIcon fontSize="small" />
);

type ShapeBuildProgressPanelControlRightContentProps = {
  nodeId?: ShapeEntity['id'];
  controlRightContent: ReactNode;
};

export const ShapeBuildProgressPanelControlRightContent = ({
  nodeId,
  controlRightContent,
  forceResetStopState,
}: ShapeBuildProgressPanelControlRightContentProps): ReactNode => {
  const isDevelopment = import.meta.env.DEV;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
      <BuildSessionLauncherPanel nodeType={toNodeType('shape')} excludeNodeId={nodeId} />
      {isDevelopment && forceResetStopState && (
        <Button
          size="small"
          variant="outlined"
          color="warning"
          startIcon={<BugReportIcon />}
          onClick={forceResetStopState}
          sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
          title="Debug: Force Reset Stop State"
        >
          Reset Stop
        </Button>
      )}
      {controlRightContent}
    </Box>
  );
};
