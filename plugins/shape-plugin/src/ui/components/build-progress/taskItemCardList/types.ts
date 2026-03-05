import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';

export type TaskItemWithMetadata = ShapeBuildTaskSummary & { title?: string };
