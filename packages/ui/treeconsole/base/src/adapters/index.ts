/**
  * TreeConsole API
  * API
  */

export { WorkerAPIAdapter } from './WorkerAPIAdapter';

export { TreeObservableAdapter } from './subscriptions/TreeObservableAdapter';
export { TreeMutationCommandsAdapter } from './commands/TreeMutationCommands';
export { WorkingCopyCommandsAdapter } from './commands/WorkingCopyCommands';
export { SubscriptionManager } from './subscriptions/SubscriptionManager';

export type {
  WorkerAPIAdapterConfig,
  AdapterContext,
  CommandAdapterOptions,
  LegacyCallback,
  LegacyUnsubscribe,
  LegacyExpandedStateChanges,
  LegacySubTreeChanges,
  TreeConsoleAdapterError,
} from './types';

export type { WorkingCopyEditSession } from './commands/WorkingCopyCommands';

export {
  createCommand,
  createAdapterGroupId,
  createAdapterCommandId,
  createTimestamp,
} from './utils';
