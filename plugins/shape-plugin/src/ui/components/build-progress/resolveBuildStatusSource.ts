export type BuildStatusSource = 'idle' | 'processing' | 'completed' | 'failed' | 'paused' | 'queued';

export const resolveBuildStatusSource = (
  persistedStatus: BuildStatusSource,
  runtimeStatus: BuildStatusSource | null,
): BuildStatusSource => {
  if (!runtimeStatus) return persistedStatus;

  const hasPersistedTerminalOrPaused = (
    persistedStatus === 'completed'
    || persistedStatus === 'failed'
    || persistedStatus === 'paused'
  );
  if (hasPersistedTerminalOrPaused && (runtimeStatus === 'processing' || runtimeStatus === 'queued')) {
    return persistedStatus;
  }
  return runtimeStatus;
};
