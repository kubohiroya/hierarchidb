import type { PeerEntity } from '@hierarchidb/core-types';
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

export interface TimelineEntityPayload {
  name: string;
  description?: string;
  tags?: string[];
  frames: TimelineFrame[];
}

export type TimelineEntity = PeerEntity<TimelineEntityPayload>;

export type TimelineDraft = TreeNodeUpdaterPayload<TimelineEntity>;
export type TimelineDraftPatch = Partial<TimelineDraft>;
