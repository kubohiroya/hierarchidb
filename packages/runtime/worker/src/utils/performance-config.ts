// Centralized performance and safety limits used by worker services
export const PERFORMANCE_CONFIG = {
  // Ring buffer sizes
  MAX_UNDO_STACK_SIZE: 100,
  MAX_REDO_STACK_SIZE: 100,
  MAX_EVENT_HISTORY_SIZE: 1000,

  // Safety limits
  MAX_ERROR_MESSAGE_LENGTH: 200,
  MAX_COMMAND_ID_LENGTH: 100,

  // Execution tuning (reserved for future use)
  COMMAND_TIMEOUT_MS: 30_000,
  BATCH_OPERATION_SIZE: 50,
} as const;
