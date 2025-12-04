import { Card, CardContent, Typography } from '@mui/material';
import type { NodeId, ShapeEntity } from '../../common/shared/index.js';
import type { TreeNodeMetadata } from '@hierarchidb/common-types';

export interface ShapePanelProps {
  nodeId: NodeId;
  entity: ShapeEntity;
  metadata?: TreeNodeMetadata;
  onEdit?: () => void;
  onError?: (error: Error) => void;
}

export function ShapePanel({ nodeId, entity, metadata }: ShapePanelProps): JSX.Element {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6">Shape Summary</Typography>
        <Typography variant="body2" color="text.secondary">
          Node: {nodeId}
        </Typography>
        <Typography variant="body1">{metadata?.name ?? 'Untitled shape'}</Typography>
        <Typography variant="body2" color="text.secondary">
          Data source: {entity.dataSourceName ?? 'unknown'}
        </Typography>
      </CardContent>
    </Card>
  );
}
