import { useEffect, useState } from 'react';

export interface UseWorkerProviderViewParams {
  createWorker: () => Worker;
}

export interface UseWorkerProviderViewResult {
  worker: Worker | undefined;
}

export function useWorkerProviderView({
  createWorker,
}: UseWorkerProviderViewParams): UseWorkerProviderViewResult {
  const [worker, setWorker] = useState<Worker | undefined>();

  useEffect(() => {
    const createdWorker = createWorker();
    setWorker(createdWorker);
  }, [createWorker]);

  return { worker };
}
