/**
 * Default Plugins Collection
 * 
 * TreeTableで使用する標準的なプラグインのコレクション
 */

import { inlineEditPlugin } from './InlineEditPlugin';
import { keyboardNavigationPlugin } from './KeyboardNavigationPlugin';
import type { TreeTablePlugin } from '../plugin/types';

/**
 * デフォルトで推奨されるプラグインのセット
 */
export const defaultPlugins: TreeTablePlugin[] = [
  keyboardNavigationPlugin,
  inlineEditPlugin,
];

/**
 * 最小限のプラグインセット（キーボードナビゲーションのみ）
 */
export const minimalPlugins: TreeTablePlugin[] = [
  keyboardNavigationPlugin,
];

/**
 * フル機能プラグインセット
 */
export const fullFeaturedPlugins: TreeTablePlugin[] = [
  keyboardNavigationPlugin,
  inlineEditPlugin,
  // 今後追加予定:
  // - dragDropPlugin
  // - contextMenuPlugin
  // - virtualScrollPlugin
  // - searchPlugin
  // - filterPlugin
  // - sortPlugin
];