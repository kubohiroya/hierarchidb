import type { BatchSession } from '../../common/types/index.js';

type Args = {
  open: boolean;
  sessions: BatchSession[];
  loading?: boolean;
};

export const useBatchRecoveryDialog = ({ open, sessions, loading }: Args) => {
  return {
    shouldRender: open,
    isLoading: Boolean(loading),
    hasSessions: sessions.length > 0,
  };
};
