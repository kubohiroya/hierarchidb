import { useMemo } from 'react';
import { useOptionalTargetNodeBuildSessionContext } from '../contexts/TreeBuildSessionContexts.js';
import {
  type BuildSessionFieldEditLock,
  type BuildSessionFieldEditLockInput,
  resolveBuildSessionFieldEditLock,
} from './resolveBuildSessionFieldEditLock.js';

export const useTargetNodeFieldEditLock = ({
  fieldId,
  lockedFieldIds,
  reason,
}: Omit<BuildSessionFieldEditLockInput, 'session'>): BuildSessionFieldEditLock => {
  const targetBuildSessionContext = useOptionalTargetNodeBuildSessionContext();
  const session = targetBuildSessionContext?.session ?? null;

  return useMemo(
    () =>
      resolveBuildSessionFieldEditLock({
        fieldId,
        lockedFieldIds,
        session,
        reason,
      }),
    [fieldId, lockedFieldIds, reason, session]
  );
};
