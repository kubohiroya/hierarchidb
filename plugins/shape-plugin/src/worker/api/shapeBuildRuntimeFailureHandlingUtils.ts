export const persistFailureAndRethrow = async (
  error: unknown,
  persist: () => Promise<void>,
  onPersistenceError: (persistenceError: unknown) => void
): Promise<never> => {
  try {
    await persist();
  } catch (persistenceError) {
    onPersistenceError(persistenceError);
  }
  throw error;
};

export const finalizePipelineOutcome = async (
  pipeline: Promise<unknown>,
  handlers: {
    onSuccess: () => Promise<void> | void;
    onFailure: (error: unknown) => Promise<void> | void;
    onFinalizationError: (error: unknown) => Promise<void> | void;
  }
): Promise<void> => {
  await pipeline.then(handlers.onSuccess, handlers.onFailure).catch(handlers.onFinalizationError);
};
