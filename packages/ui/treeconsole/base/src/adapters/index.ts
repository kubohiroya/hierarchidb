/**
 * TreeConsole APIアダプター エクスポート
 *
 * 新旧API変換に必要なすべてのクラスと型定義をエクスポートします。
 */

// メインアダプタークラス
export { WorkerAPIAdapter } from './WorkerAPIAdapter';

// 個別アダプター（必要に応じて直接使用可能）
export { TreeObservableAdapter } from './subscriptions/TreeObservableAdapter';
export { TreeMutationCommandsAdapter } from './commands/TreeMutationCommands';
export { WorkingCopyCommandsAdapter } from './commands/WorkingCopyCommands';
export { SubscriptionManager } from './subscriptions/SubscriptionManager';

// 型定義
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

// ユーティリティ関数
export {
  createCommand,
  createAdapterGroupId,
  createAdapterCommandId,
  createTimestamp,
} from './utils';
