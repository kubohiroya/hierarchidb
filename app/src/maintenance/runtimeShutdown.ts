import { Dexie } from 'dexie';
import { geosWorkerClient } from '~/geos/geosWorkerClient';

type WorkerClientRefLike = {
  client?: {
    shutdown?: () => Promise<void>;
  } | null;
  reset?: () => void;
};
type MaintenanceWindow = Window & {
  __HDB_WORKER_CLIENT_REF__?: WorkerClientRefLike;
};

export interface RuntimeShutdownResult {
  warnings: string[];
}

export async function shutdownRuntimeHandles(): Promise<RuntimeShutdownResult> {
  const warnings: string[] = [];

  if (typeof window !== 'undefined') {
    const ref = (window as MaintenanceWindow).__HDB_WORKER_CLIENT_REF__;
    try {
      if (typeof ref?.client?.shutdown === 'function') {
        await ref.client.shutdown();
      }
    } catch (error) {
      warnings.push(
        `worker-shutdown-failed:${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      if (typeof ref?.reset === 'function') {
        ref.reset();
      }
    } catch (error) {
      warnings.push(`worker-reset-failed:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    const closeAll = (Dexie as { closeAll?: () => void }).closeAll;
    closeAll?.();
  } catch (error) {
    warnings.push(`dexie-close-failed:${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    geosWorkerClient.shutdown();
  } catch (error) {
    warnings.push(`geos-shutdown-failed:${error instanceof Error ? error.message : String(error)}`);
  }

  return { warnings };
}
