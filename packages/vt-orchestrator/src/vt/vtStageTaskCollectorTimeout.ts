type TaskCollectTimeoutConfig = {
  testTimeoutMs?: number;
};

type TimeoutErrorFactory = (input: {
  nodeId: string;
  taskId?: string;
  timeoutMs: number;
}) => Error;

type WithCollectTimeoutInput<T> = {
  nodeId: string;
  taskId?: string;
  promise: Promise<T>;
  timeoutMs?: number;
  errorFactory?: TimeoutErrorFactory;
};

export const withCollectTimeout = async <T>(
  input: WithCollectTimeoutInput<T>,
): Promise<T> => {
  const {
    nodeId,
    taskId,
    promise,
    timeoutMs,
    errorFactory = ({ nodeId, taskId, timeoutMs }) => new Error(
      `[vt] collect timeout after ${timeoutMs}ms (nodeId=${nodeId}, taskId=${taskId ?? 'unknown'})`,
    ),
  } = input;
  if (!(typeof timeoutMs === 'number' && timeoutMs > 0)) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(errorFactory({
        nodeId,
        taskId,
        timeoutMs,
      }));
    }, timeoutMs);

    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => clearTimeout(timeoutId));
  });
};

export const getCollectTimeoutMs = (
  settings: TaskCollectTimeoutConfig,
): number | undefined => settings.testTimeoutMs;
