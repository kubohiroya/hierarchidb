/**
 * DualLayerWorkerProvider - Combined two-layer Worker initialization system
 *
 * This component combines WorkerSingletonProvider and WorkerClientProvider to provide
 * a complete Worker initialization and Comlink wrapping solution with
 * lazy singleton initialization support.
 */

import type { Remote } from 'comlink';
import React, { type ReactNode } from 'react';
import type { InitializationResult } from '../types.js';
// import { WorkerSingletonProvider } from './WorkerSingletonProvider.js'; // Temporarily disabled
import { createWorkerClientProvider } from './WorkerClientProvider.js';

export interface WorkerProviderProps<T> {
  /** Function to create the Worker instance */
  createWorker: () => Worker;
  /** Function to wrap Worker with Comlink (can be async for lazy initialization) */
  wrapWorker: (worker: Worker) => Remote<T> | Promise<Remote<T>>;
  /** Children to render after full initialization */
  children: ReactNode;
  /** Component to show during Worker initialization */
  loadingWorkerComponent?: ReactNode;
  /** Component to show during Comlink setup */
  loadingClientComponent?: ReactNode;
  /** Component to show on Worker initialization error */
  errorWorkerComponent?: (error: Error) => ReactNode;

  /** Worker initialization timeout in milliseconds */
  workerTimeout?: number;
  /** Health check interval for Comlink connection (0 to disable) */
  healthCheckInterval?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Callback when Worker is initialized */
  onWorkerInitialized?: (worker: Worker, result: InitializationResult) => void;
  /** Callback when Comlink client is ready */
  onClientReady?: (client: Remote<T>) => void;
}

/**
 * Create a dual-layer Worker provider for a specific Worker type
 */
export function createWorkerProvider<T>() {
  const { WorkerClientProvider, useWorkerClient } = createWorkerClientProvider<T>();

  const WorkerProvider: React.FC<WorkerProviderProps<T>> = ({
    createWorker,
    wrapWorker,
    children,
    loadingWorkerComponent = <div>Initializing Worker...</div>,
    loadingClientComponent = <div>Setting up Worker client...</div>,
    // errorWorkerComponent,
    // workerTimeout = 30000,
    healthCheckInterval = 30000,
    debug = false,
    // onWorkerInitialized,
    onClientReady,
  }) => {
    // Temporary workaround: directly render WorkerClientProvider
    // TODO: Fix WorkerSingletonProvider to support render props properly
    const [worker, setWorker] = React.useState<Worker | null>(null);

    React.useEffect(() => {
      const w = createWorker();
      setWorker(w);
    }, [createWorker]);

    if (!worker) {
      return <>{loadingWorkerComponent}</>;
    }

    return (
      <WorkerClientProvider
        worker={worker}
        wrapWorker={wrapWorker}
        loadingComponent={loadingClientComponent}
        debug={debug}
        healthCheckInterval={healthCheckInterval}
        onClientReady={onClientReady}
      >
        {children}
      </WorkerClientProvider>
    );
  };

  return {
    DualLayerWorkerProvider: WorkerProvider,
    useWorkerClient,
  };
}

/**
 * Example usage with async lazy singleton initialization:
 *
 * ```typescript
 * // Define your Worker API type
 * interface MyWorkerAPI {
 *   initialize(): Promise<void>;
 *   ping(): Promise<{ response: string }>;
 *   getData(): Promise<any>;
 * }
 *
 * // Create provider and hook
 * const { DualLayerWorkerProvider, useWorkerClient } = createDualLayerWorkerProvider<MyWorkerAPI>();
 *
 * // Use in your app
 * function App() {
 *   return (
 *     <DualLayerWorkerProvider
 *       createWorker={() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })}
 *       wrapWorker={async (worker) => {
 *         const Comlink = await import('comlink');
 *         const wrapped = Comlink.wrap<MyWorkerAPI>(worker);
 *
 *         // Wait for Worker's async lazy singleton initialization
 *         await wrapped.initialize();
 *
 *         return wrapped;
 *       }}
 *       debug={true}
 *     >
 *       <MyApp />
 *     </DualLayerWorkerProvider>
 *   );
 * }
 *
 * // Use in components
 * function MyComponent() {
 *   const { client, isConnected } = useWorkerClient();
 *
 *   // Use the fully initialized client
 *   const handleClick = async () => {
 *     const data = await client.getData();
 *     console.log(data);
 *   };
 *
 *   return (
 *     <div>
 *       <p>Connection: {isConnected ? 'Connected' : 'Disconnected'}</p>
 *       <button onClick={handleClick}>Get Data</button>
 *     </div>
 *   );
 * }
 * ```
 */
