/**
 * React hook for WorkerAPIClient
 * Provides compatibility with existing code
 */

import { useEffect, useState } from 'react';
import { WorkerAPIClient, NotInitializedError } from '../WorkerAPIClient';

export function useWorkerAPIClient() {
  const [client, setClient] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      // 同期的に取得を試みる
      const workerClient = WorkerAPIClient.getSingleton();
      
      // 既存のコードがclient.getAPI()を呼び出すことを想定
      setClient({
        getAPI: () => workerClient
      });
    } catch (err) {
      if (err instanceof NotInitializedError) {
        // 初期化されていない場合は、初期化を待つ
        WorkerAPIClient.initialize()
          .then(() => {
            const workerClient = WorkerAPIClient.getSingleton();
            setClient({
              getAPI: () => workerClient
            });
          })
          .catch(setError);
      } else {
        setError(err as Error);
      }
    }
  }, []);

  // エラーまたは未初期化の場合はnullを返す
  if (error || !client) {
    return null;
  }
  
  return client;
}