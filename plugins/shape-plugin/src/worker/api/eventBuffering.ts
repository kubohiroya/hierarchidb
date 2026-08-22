/**
 * Re-exports UnconditionalEventStreamer from @hierarchidb/build-runtime-services.
 * The implementation has been lifted to the shared package per Issue #1143.
 */

export type {
  EventPayload,
  NotificationType,
} from '@hierarchidb/build-runtime-services';
export {
  UnconditionalEventStreamer,
  unconditionalEventStreamer,
} from '@hierarchidb/build-runtime-services';
