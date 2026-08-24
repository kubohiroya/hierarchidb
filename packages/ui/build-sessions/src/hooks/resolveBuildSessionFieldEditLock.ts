import type { NodeId } from '@hierarchidb/core-types';
import type { BuildSessionSnapshot } from './useBuildSessionSnapshots.js';

const DEFAULT_BUILD_SESSION_FIELD_LOCK_REASON =
  'This field is locked while a canonical build session is queued or running.';

export type BuildSessionFieldEditLock = {
  readonly locked: boolean;
  readonly reason?: string;
  readonly sessionNodeId?: NodeId;
  readonly sessionStatus?: BuildSessionSnapshot['status'];
};

export type BuildSessionFieldEditLockInput = {
  readonly fieldId: string;
  readonly lockedFieldIds: readonly string[];
  readonly session?: BuildSessionSnapshot | null;
  readonly reason?: string;
};

const assertNonEmptyFieldId = (value: string, fieldName: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} must be a non-empty field id.`);
  }
  return trimmed;
};

export const resolveBuildSessionFieldEditLock = ({
  fieldId,
  lockedFieldIds,
  session,
  reason = DEFAULT_BUILD_SESSION_FIELD_LOCK_REASON,
}: BuildSessionFieldEditLockInput): BuildSessionFieldEditLock => {
  const targetFieldId = assertNonEmptyFieldId(fieldId, 'fieldId');
  const lockedFieldIdSet = new Set(
    lockedFieldIds.map((lockedFieldId) => assertNonEmptyFieldId(lockedFieldId, 'lockedFieldId'))
  );

  if (!session?.isActive) {
    return { locked: false };
  }

  const sessionContext = {
    sessionNodeId: session.nodeId,
    sessionStatus: session.status,
  };

  if (!lockedFieldIdSet.has(targetFieldId)) {
    return {
      locked: false,
      ...sessionContext,
    };
  }

  return {
    locked: true,
    reason,
    ...sessionContext,
  };
};
