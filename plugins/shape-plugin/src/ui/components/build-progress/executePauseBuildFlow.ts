import {
  executePauseBuildFlow as executePauseBuildFlowFromComponents,
  type PauseBuildReason as PauseBuildReasonFromComponents,
} from '@hierarchidb/components';

/**
 * @deprecated Use `executePauseBuildFlow` from `@hierarchidb/components` directly.
 */
export const executePauseBuildFlow = executePauseBuildFlowFromComponents;

/**
 * @deprecated Use `PauseBuildReason` from `@hierarchidb/components` directly.
 */
export type PauseBuildReason = PauseBuildReasonFromComponents;
