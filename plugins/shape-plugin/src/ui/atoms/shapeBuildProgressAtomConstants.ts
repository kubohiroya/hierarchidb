import { atom } from 'jotai';
import type { TaskScrollTarget, TaskViewportRange } from '~/ui/atoms/shapeBuildProgressTypes';

export type {
  TaskScrollTarget,
  TaskViewportRange,
} from '~/ui/atoms/shapeBuildProgressTypes';
export const taskScrollTargetAtom = atom<TaskScrollTarget | null>(null);
// Keyed by normalized stageId so each stage maintains its own viewport range independently.
export const taskViewportRangeByStageAtom = atom<Record<string, TaskViewportRange>>({});
