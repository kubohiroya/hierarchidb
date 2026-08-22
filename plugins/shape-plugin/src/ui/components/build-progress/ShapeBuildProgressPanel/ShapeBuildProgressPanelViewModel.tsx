import { toNodeType } from '@hierarchidb/core-types';
import { BuildSessionLauncherPanel } from '@hierarchidb/ui-build-sessions';
import ConstructionIcon from '@mui/icons-material/Construction';
import { Box } from '@mui/material';
import { type ReactNode } from 'react';
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
}: ShapeBuildProgressPanelControlRightContentProps): ReactNode => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        justifyContent: 'flex-end',
        flexWrap: 'nowrap',
      }}
    >
      <BuildSessionLauncherPanel nodeType={toNodeType('shape')} excludeNodeId={nodeId} />
      {controlRightContent}
    </Box>
  );
};
