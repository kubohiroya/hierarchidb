import type { NodeId } from '@hierarchidb/core-types';
import {
  resolveBuildSessionNavigationNodeType,
  useOptionalBuildSessionRuntimeContext,
  useOptionalPageNodeContext,
  useOptionalTargetNodeContext,
  useOptionalTreeContext,
} from '@hierarchidb/ui-build-sessions';
import { CircularProgress, IconButton, type SxProps, type Theme, Tooltip } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';

type BuildSessionSpinnerButtonProps = {
  nodeId: NodeId;
  size?: number;
  thickness?: number;
  sx?: SxProps<Theme>;
};

export function BuildSessionSpinnerButton({
  nodeId,
  size = 16,
  thickness = 5,
  sx,
}: BuildSessionSpinnerButtonProps) {
  const navigate = useNavigate();
  const treeContext = useOptionalTreeContext();
  const pageNodeContext = useOptionalPageNodeContext();
  const targetNodeContext = useOptionalTargetNodeContext();
  const runtimeContext = useOptionalBuildSessionRuntimeContext();

  const session = runtimeContext?.sessionByNodeId.get(nodeId) ?? null;
  if (!session) {
    return null;
  }

  const treeId = treeContext?.treeId;
  const pageNodeId = pageNodeContext?.pageNodeId;

  const handleClick = () => {
    if (!treeId || !pageNodeId) {
      return;
    }
    const nodeType = resolveBuildSessionNavigationNodeType({
      nodeId,
      runtimeNodeType: runtimeContext?.nodeType ?? null,
      targetNodeId: targetNodeContext?.targetNodeId ?? null,
      targetNodeType: targetNodeContext?.nodeType ?? null,
    });
    navigate({ to: `/t/${treeId}/${pageNodeId}/${nodeId}/${nodeType}` });
  };

  const isNavigable = Boolean(treeId && pageNodeId);
  const tooltipLabel = session.isActive
    ? 'Open active build session'
    : 'Open running build session';

  return (
    <Tooltip title={tooltipLabel}>
      <span>
        <IconButton
          size="small"
          onClick={handleClick}
          disabled={!isNavigable}
          sx={{ p: 0, ...(sx ?? {}) }}
          aria-label={tooltipLabel}
        >
          <CircularProgress
            size={size}
            thickness={thickness}
            color={session.isActive ? 'primary' : 'inherit'}
          />
        </IconButton>
      </span>
    </Tooltip>
  );
}
