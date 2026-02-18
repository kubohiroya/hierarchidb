export type PauseBuildReason = 'route-leave' | 'user-pause';

type ExecutePauseBuildFlowArgs = {
  reason: PauseBuildReason;
  onPendingChange: (pending: boolean) => void;
  onAccepted?: () => void | Promise<void>;
  pauseSession: (reason: PauseBuildReason) => Promise<void>;
  persistPausedStatus: (reason: PauseBuildReason) => Promise<void>;
  onError: (error: unknown) => void;
};

export const executePauseBuildFlow = async ({
  reason,
  onPendingChange,
  onAccepted,
  pauseSession,
  persistPausedStatus,
  onError,
}: ExecutePauseBuildFlowArgs): Promise<void> => {
  onPendingChange(true);
  try {
    await pauseSession(reason);
    await persistPausedStatus(reason);
    await onAccepted?.();
  } catch (error) {
    onError(error);
    onPendingChange(false);
  }
};
