import type { BaseEntity, NodeId, Timestamp } from '@hierarchidb/core-types';
import type { TreeNodeUpdaterPayload } from '@hierarchidb/tree-api';

export interface TimelineFrameViewState {
  longitude: number;
  latitude: number;
  zoom?: number;
  bearing?: number;
  pitch?: number;
}

export interface TimelineFrame {
  id: string;
  name: string;
  viewState?: TimelineFrameViewState;
}

export interface TimelineEntity extends BaseEntity<NodeId> {
  id: NodeId;
  name: string;
  description?: string;
  tags?: string[];
  frames: TimelineFrame[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TimelineDraft = TreeNodeUpdaterPayload<Partial<TimelineEntity>>;
export type TimelineDraftPatch = Partial<TimelineDraft>;
