export type BuildStatusSource = 'idle' | 'running' | 'completed' | 'failed' | 'paused' | 'queued';

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
  if (hasPersistedTerminalOrPaused && (runtimeStatus === 'running' || runtimeStatus === 'queued')) {
    return persistedStatus;
  }
  return runtimeStatus;
};
