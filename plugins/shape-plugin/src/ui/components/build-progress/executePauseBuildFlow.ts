import {
  executePauseBuildFlow as executePauseBuildFlowFromComponents,
  type PauseBuildReason as PauseBuildReasonFromComponents,
} from '@hierarchidb/components/build-session';

/**
 * @deprecated Use `executePauseBuildFlow` from `@hierarchidb/components` directly.
 */
export const executePauseBuildFlow = executePauseBuildFlowFromComponents;

/**
 * @deprecated Use `PauseBuildReason` from `@hierarchidb/components` directly.
 */
export type PauseBuildReason = PauseBuildReasonFromComponents;
