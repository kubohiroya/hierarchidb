export type PauseBuildReason = 'route-leave' | 'user-pause';

type ExecutePauseBuildFlowArgs = {
  reason: PauseBuildReason;
  onPendingChange: (pending: boolean) => void;
  pauseSession: (reason: PauseBuildReason) => Promise<void>;
  persistPausedStatus: (reason: PauseBuildReason) => Promise<void>;
  onError: (error: unknown) => void;
};

export const executePauseBuildFlow = async ({
  reason,
  onPendingChange,
  pauseSession,
  persistPausedStatus,
  onError,
}: ExecutePauseBuildFlowArgs): Promise<void> => {
  onPendingChange(true);
  try {
    await pauseSession(reason);
    await persistPausedStatus(reason);
  } catch (error) {
    onError(error);
  } finally {
    onPendingChange(false);
  }
};
