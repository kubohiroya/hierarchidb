import { type ReactNode } from 'react';
import { Box } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import { BuildSessionLauncherPanel } from '@hierarchidb/ui-build-sessions';
import { toNodeType } from '@hierarchidb/core-types';
import type { ShapeEntity } from '~/common/types/ShapeEntity';

export const renderShapeBuildProgressPanelStartIcon = (): ReactNode => (
  <ConstructionIcon fontSize="small" />
);

type ShapeBuildProgressPanelControlRightContentProps = {
  nodeId?: ShapeEntity['id'];
  controlRightContent: ReactNode;
};

export const renderShapeBuildProgressPanelControlRightContent = ({
  nodeId,
  controlRightContent,
}: ShapeBuildProgressPanelControlRightContentProps): ReactNode => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
    <BuildSessionLauncherPanel nodeType={toNodeType('shape')} excludeNodeId={nodeId} />
    {controlRightContent}
  </Box>
);
