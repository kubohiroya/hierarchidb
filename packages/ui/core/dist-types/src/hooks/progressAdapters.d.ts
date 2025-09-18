import type { ProgressEvent } from '@hierarchidb/common-type';
import type { BatchProgressAdapter, UnifiedProgressInfo } from './useBatchProgress.js';
export declare function progressEventToUnified(p: ProgressEvent): UnifiedProgressInfo;
export declare function createAdapterFromProgressSubscribe(subscribeToProgress: (cb: (e: ProgressEvent) => void) => (() => void) | Promise<() => void>): BatchProgressAdapter;
//# sourceMappingURL=progressAdapters.d.ts.map