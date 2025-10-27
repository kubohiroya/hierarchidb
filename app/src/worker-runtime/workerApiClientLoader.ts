/**
 * @file workerApiClientLoader.ts
 * @description Cached dynamic loader for WorkerAPIClient to keep the class out of the initial app chunk.
 */

type WorkerAPIClientModule = typeof import('../WorkerAPIClient.ts');

let cachedModule: WorkerAPIClientModule | null = null;
let modulePromise: Promise<WorkerAPIClientModule> | null = null;

export const getWorkerAPIClientModule = (): WorkerAPIClientModule | null => cachedModule;

export const loadWorkerAPIClientModule = async (): Promise<WorkerAPIClientModule> => {
  if (cachedModule) return cachedModule;
  if (!modulePromise) {
    modulePromise = import('../WorkerAPIClient.ts').then((mod) => {
      cachedModule = mod;
      return mod;
    });
  }
  return modulePromise;
};

export const resetWorkerAPIClientModuleForTests = () => {
  cachedModule = null;
  modulePromise = null;
};

export type { WorkerAPIClientModule };
