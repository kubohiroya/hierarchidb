/**
  * TreeConsole API
  * API
  */

export { WorkerAPIAdapter } from './WorkerAPIAdapter.js';

export { TreeObservableAdapter } from './subscriptions/TreeObservableAdapter.js';
export { TreeMutationCommandsAdapter } from './commands/TreeMutationCommands.js';
export { DraftCommandsAdapter } from './commands/DraftCommands.js';
export { SubscriptionManager } from './subscriptions/SubscriptionManager.js';

export type {
  WorkerAPIAdapterConfig,
  AdapterContext,
  CommandAdapterOptions,
  LegacyCallback,
  LegacyUnsubscribe,
  LegacyExpandedStateChanges,
  LegacySubTreeChanges,
  TreeConsoleAdapterError,
} from './types.js';

export type { DraftEditSession } from './commands/DraftCommands.js';

export {
  createCommand,
  createAdapterGroupId,
  createAdapterCommandId,
  createTimestamp,
} from './utils.js';
