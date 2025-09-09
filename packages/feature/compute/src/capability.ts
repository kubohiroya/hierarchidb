let workerPoolEnabled = false;
let batchComputeEnabled = false;

export function enableWorkerPool(): void {
  workerPoolEnabled = true;
}

export function disableWorkerPool(): void {
  workerPoolEnabled = false;
}

export function isWorkerPoolEnabled(): boolean {
  return workerPoolEnabled;
}

export function enableBatchCompute(): void {
  batchComputeEnabled = true;
}

export function disableBatchCompute(): void {
  batchComputeEnabled = false;
}

export function isBatchComputeEnabled(): boolean {
  return batchComputeEnabled;
}

