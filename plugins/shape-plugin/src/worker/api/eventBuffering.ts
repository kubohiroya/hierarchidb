/**
 * Re-exports UnconditionalEventStreamer from @hierarchidb/build-runtime-services.
 * The implementation has been lifted to the shared package per Issue #1143.
 */
export {
    UnconditionalEventStreamer,
    unconditionalEventStreamer,
} from '@hierarchidb/build-runtime-services';
export type {
    NotificationType,
    EventPayload,
} from '@hierarchidb/build-runtime-services';
