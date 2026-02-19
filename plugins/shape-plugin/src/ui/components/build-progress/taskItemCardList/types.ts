import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';

export type TaskItemWithMetadata = ShapeBuildTaskSummary & { title?: string };
