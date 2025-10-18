import type { NodeId } from '../../common/shared/index.js';

export interface TilePreviewProps {
  sessionId: string;
  nodeId: NodeId;
}

export function TilePreview({ sessionId, nodeId }: TilePreviewProps): JSX.Element | null {
  void sessionId;
  void nodeId;
  return null;
}
