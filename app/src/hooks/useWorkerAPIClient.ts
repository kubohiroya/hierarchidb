/**
 * React hook for WorkerAPIClient
 * Provides compatibility with existing code
 */

import { useEffect, useState } from 'react';
import { NotInitializedError, WorkerAPIClient } from '../WorkerAPIClient';

export function useWorkerAPIClient() {
  const [client, setClient] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const workerClient = WorkerAPIClient.getSingleton();

      setClient({
        getAPI: () => workerClient,
      });
    } catch (err) {
      if (err instanceof NotInitializedError) {
        WorkerAPIClient.initialize()
          .then(() => {
            const workerClient = WorkerAPIClient.getSingleton();
            setClient({
              getAPI: () => workerClient,
            });
          })
          .catch(setError);
      } else {
        setError(err as Error);
      }
    }
  }, []);

  //  null
  if (error || !client) {
    return null;
  }

  return client;
}