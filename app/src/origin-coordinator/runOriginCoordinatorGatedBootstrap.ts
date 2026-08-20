export interface OriginCoordinatorGatedBootstrapOperations<TCoordinator, TRuntime> {
  initializeCoordinator(): Promise<TCoordinator>;
  acceptCoordinator(coordinator: TCoordinator): void;
  initializeBrowserGlobals(): void;
  preloadWorkerStores(): Promise<void>;
  initializeRuntime(): Promise<TRuntime>;
}

export async function runOriginCoordinatorGatedBootstrap<TCoordinator, TRuntime>(
  operations: OriginCoordinatorGatedBootstrapOperations<TCoordinator, TRuntime>
): Promise<TRuntime> {
  const coordinator = await operations.initializeCoordinator();
  operations.acceptCoordinator(coordinator);
  operations.initializeBrowserGlobals();
  await operations.preloadWorkerStores();
  return await operations.initializeRuntime();
}
