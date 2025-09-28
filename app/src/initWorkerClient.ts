// Deprecated compatibility shim for legacy imports.
// Provides lazy wrappers around the dynamic client module to avoid static bundling.
type ClientModule = typeof import('./client.js');
type InitializeWorkerFn = ClientModule['initializeWorker'];
type GetWorkerClientFn = ClientModule['getWorkerClient'];
type GetRawWorkerInstanceFn = ClientModule['getRawWorkerInstance'];
type IsWorkerInitCompletedFn = ClientModule['isWorkerInitCompleted'];

let cachedModule: ClientModule | null = null;
let modulePromise: Promise<ClientModule> | null = null;

async function loadClientModule(): Promise<ClientModule> {
  if (cachedModule) return cachedModule;
  if (!modulePromise) {
    modulePromise = import('./client.js')
      .then((module) => {
        cachedModule = module;
        return module;
      })
      .catch((error) => {
        modulePromise = null;
        throw error;
      });
  }
  return modulePromise;
}

export async function initializeWorker(): ReturnType<InitializeWorkerFn> {
  const module = await loadClientModule();
  return module.initializeWorker();
}

export async function getWorkerClient(): ReturnType<GetWorkerClientFn> {
  const module = await loadClientModule();
  return module.getWorkerClient();
}

export function getRawWorkerInstance(): ReturnType<GetRawWorkerInstanceFn> {
  return cachedModule?.getRawWorkerInstance?.() ?? null;
}

export function isWorkerInitCompleted(): ReturnType<IsWorkerInitCompletedFn> {
  return cachedModule?.isWorkerInitCompleted?.() ?? false;
}
