/**
  * TreeConsole API
  * API
 * CommandEnvelopestring
  */
import type { CommandEnvelope, OnNameConflict, Timestamp } from '@hierarchidb/common-type';
/**
  * CommandEnvelope
  * CommandEnvelope
 * TreeObservableService.test.ts
  */
export declare function createCommand<K extends string, P>(kind: K, payload: P, options?: {
    groupId?: string;
    sourceViewId?: string;
    onNameConflict?: OnNameConflict;
}): CommandEnvelope<K, P>;
/**
  * string
  */
export declare function createAdapterGroupId(): string;
export declare function createAdapterCommandId(): string;
/**
    */
export declare function createTimestamp(): Timestamp;
//# sourceMappingURL=utils.d.ts.map