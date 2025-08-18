/**
 * @hierarchidb/ui-treeconsole
 * 
 * TreeConsole UI components for HierarchiDB
 * Migrated from eria-cartograph/app0 to independent package
 */

// APIアダプター（新旧API変換レイヤー）
export * from './adapters';

// 型定義
export * from './types';

// Hooks
export { useTreeViewController } from './hooks/useTreeViewController';
export type { UseTreeViewControllerOptions, UseTreeViewControllerReturn } from './hooks/useTreeViewController';

// コンポーネント
export { TreeTableConsolePanel } from './components/TreeTableConsolePanel';
export type { TreeTableConsolePanelProps } from './types';

export { TreeConsoleHeader } from './components/TreeConsoleHeader';
export type { TreeConsoleHeaderProps } from './types';

export { TreeConsoleContent } from './components/TreeConsoleContent';
export type { TreeConsoleContentProps } from './types';

export { TreeConsoleToolbar } from './components/TreeConsoleToolbar';
export type { TreeConsoleToolbarProps } from './types';

export { TreeConsoleFooter } from './components/TreeConsoleFooter';
export type { TreeConsoleFooterProps } from './types';

export { TreeConsoleActions } from './components/TreeConsoleActions';
export type { TreeConsoleActionsProps } from './types';

export { TreeConsoleBreadcrumb } from './components/TreeConsoleBreadcrumb';
export type { TreeConsoleBreadcrumbProps } from './types';

export { TreeTableConsolePanelContext } from './components/TreeTableConsolePanelContext';

// メインエクスポート（後方互換性）
export { TreeTableConsolePanel as TreeConsole } from './components/TreeTableConsolePanel';
export { TreeTableConsolePanelContext as TreeConsoleContext } from './components/TreeTableConsolePanelContext';