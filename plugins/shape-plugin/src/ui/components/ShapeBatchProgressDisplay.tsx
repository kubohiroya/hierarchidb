export interface ShapeBatchProgressDisplayProps {
  treeNodeId?: string;
  sessionId?: string;
  progressEvents?: unknown[];
}

export function ShapeBatchProgressDisplay({
  treeNodeId,
  sessionId,
  progressEvents,
}: ShapeBatchProgressDisplayProps): JSX.Element | null {
  void treeNodeId;
  void sessionId;
  void progressEvents;
  return null;
}
