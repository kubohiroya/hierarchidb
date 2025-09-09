let batchEnabled = false;

export function enableBatch(): void {
  batchEnabled = true;
}

export function disableBatch(): void {
  batchEnabled = false;
}

export function isBatchEnabled(): boolean {
  return batchEnabled;
}

