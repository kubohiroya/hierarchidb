import { atom } from 'jotai';
import type {
  TaskScrollTarget,
  TaskViewportRange,
} from '~/ui/atoms/shapeBuildProgressTypes';

export type {
  TaskScrollTarget,
  TaskViewportRange,
} from '~/ui/atoms/shapeBuildProgressTypes';
export const taskScrollTargetAtom = atom<TaskScrollTarget | null>(null);
export const taskViewportRangeAtom = atom<TaskViewportRange | null>(null);
