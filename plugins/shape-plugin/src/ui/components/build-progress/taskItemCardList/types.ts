import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms.js';

export type TaskItemWithMetadata = ShapeBuildTaskSummary & { title?: string };
