export type ProgressState = {
  lastReportAt: number;
  lastReported: number;
  lastMessage: string | null;
};

export const shouldReportProgress = ({
  force,
  message,
  lastMessage,
  processedTiles,
  lastReported,
  lastReportAt,
  now,
}: {
  force: boolean;
  message: string | undefined;
  lastMessage: string | null;
  processedTiles: number;
  lastReported: number;
  lastReportAt: number;
  now: number;
}): boolean => {
  if (force) {
    return true;
  }
  const shouldReportMessage = Boolean(message) && message !== lastMessage;
  if (shouldReportMessage) {
    return true;
  }
  if (processedTiles === lastReported) {
    return false;
  }
  if (processedTiles - lastReported >= 25) {
    return true;
  }
  if (now - lastReportAt >= 500) {
    return true;
  }
  return false;
};

export const updateProgressState = ({
  at,
  processedTiles,
  message,
}: {
  at: number;
  processedTiles: number;
  message: string | undefined;
}): ProgressState => ({
  lastReportAt: at,
  lastReported: processedTiles,
  lastMessage: message ?? null,
});

export const calculateProgress = (processedTiles: number, totalTiles: number): number =>
  totalTiles > 0 ? Math.min(100, Math.max(0, Math.round((processedTiles / totalTiles) * 100))) : 0;

export type VtTileProgressPayload = {
  processedTiles: number;
  generatedTiles: number;
  progress: number;
  message?: string;
  metadata: Record<string, unknown>;
  outputData: {
    tilesGenerated: number;
    totalTiles: number;
  };
};

export const buildProgressPayload = ({
  processedTiles,
  generatedTiles,
  message,
  totalTiles,
  parentInputMetadata,
}: {
  processedTiles: number;
  generatedTiles: number;
  message?: string;
  totalTiles: number;
  parentInputMetadata: Record<string, unknown>;
}): VtTileProgressPayload => ({
  processedTiles,
  generatedTiles,
  progress: calculateProgress(processedTiles, totalTiles),
  metadata: parentInputMetadata,
  outputData: {
    tilesGenerated: generatedTiles,
    totalTiles,
  },
  ...(message ? { message } : {}),
});
