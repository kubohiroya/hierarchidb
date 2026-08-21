import type { OriginCoordinatorBootGate, OriginCoordinatorClientHandle } from './types.js';

export interface OriginCoordinatorGatedBootstrapOperations<TRuntime> {
  initializeCoordinator(): Promise<OriginCoordinatorBootGate>;
  acceptActivationCoordinator(coordinator: OriginCoordinatorClientHandle): void;
  activateCanonicalStorage(coordinator: OriginCoordinatorClientHandle): Promise<void>;
  requestSuccessReload(): void;
  prepareCanonicalRuntime(): Promise<void>;
  initializeBrowserGlobals(): void;
  initializeRuntime(): Promise<TRuntime>;
}

export type OriginCoordinatorGatedBootstrapResult<TRuntime> =
  | Readonly<{ readonly status: 'reload-requested' }>
  | Readonly<{ readonly status: 'runtime-ready'; readonly runtime: TRuntime }>;

export async function runOriginCoordinatorGatedBootstrap<TRuntime>(
  operations: OriginCoordinatorGatedBootstrapOperations<TRuntime>
): Promise<OriginCoordinatorGatedBootstrapResult<TRuntime>> {
  const gate = await operations.initializeCoordinator();
  if (gate.status === 'activation-allowed') {
    operations.acceptActivationCoordinator(gate.coordinator);
    await operations.activateCanonicalStorage(gate.coordinator);
    operations.requestSuccessReload();
    return Object.freeze({ status: 'reload-requested' });
  }

  await operations.prepareCanonicalRuntime();
  operations.initializeBrowserGlobals();
  const runtime = await operations.initializeRuntime();
  return Object.freeze({ status: 'runtime-ready', runtime });
}
