import type { BatchProgressEvent } from '@hierarchidb/runtime-shared-batch-processor';
import type { BatchProgressAdapter, UnifiedProgressInfo } from './useBatchProgress.js';
export declare function progressEventToUnified(event: BatchProgressEvent): UnifiedProgressInfo;
export declare function createAdapterFromProgressSubscribe(subscribeToProgress: (cb: (event: BatchProgressEvent) => void) => (() => void) | Promise<() => void>): BatchProgressAdapter;
//# sourceMappingURL=progressAdapters.d.ts.map