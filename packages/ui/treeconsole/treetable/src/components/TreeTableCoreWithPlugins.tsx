/**
 * TreeTableCore with Optional Plugin Support
 *
 * TreeTableCoreにオプショナルなプラグインサポートを追加したバージョン。
 * 後方互換性を維持しながら、段階的にプラグイン機能を導入できます。
 */

import { TreeTableCore as TreeTableCoreOriginal } from './TreeTableCore';
import { PluginProvider } from '../plugin/PluginProvider';
import type { TreeTableCoreProps } from '../types';
import type { TreeTablePlugin, TreeTablePluginConfig, PluginEvent } from '../plugin/types';

// 拡張されたプロパティインターフェース
export interface TreeTableCorePropsWithPlugins extends TreeTableCoreProps {
  /**
   * プラグインの配列（オプショナル）
   */
  plugins?: TreeTablePlugin[];
  
  /**
   * プラグインの設定（オプショナル）
   */
  pluginConfig?: TreeTablePluginConfig;
  
  /**
   * プラグインイベントのリスナー（オプショナル）
   */
  onPluginEvent?: (event: PluginEvent) => void;
  
  /**
   * プラグインを有効にするかどうか（デフォルト: false）
   */
  enablePlugins?: boolean;
  
  /**
   * プラグインのデバッグモードを有効にする（オプショナル）
   */
  debugPlugins?: boolean;
}

/**
 * TreeTableCore メインコンポーネント（プラグインサポート付き）
 * 
 * プラグインが有効な場合はProviderでラップし、
 * 無効な場合は従来通りのTreeTableCoreを直接レンダリングします。
 */
export function TreeTableCoreWithPlugins(props: TreeTableCorePropsWithPlugins) {
  const {
    plugins,
    pluginConfig,
    onPluginEvent,
    enablePlugins = false,
    debugPlugins = false,
    ...coreProps
  } = props;
  
  // プラグインが有効かつ存在する場合はProviderでラップ
  if (enablePlugins && plugins && plugins.length > 0) {
    return (
      <PluginProvider
        plugins={plugins}
        config={pluginConfig}
        onPluginEvent={onPluginEvent}
        debugMode={debugPlugins}
      >
        <TreeTableCoreWithPluginContext {...coreProps} />
      </PluginProvider>
    );
  }
  
  // プラグインが無効または存在しない場合は直接レンダリング
  return <TreeTableCoreOriginal {...coreProps} />;
}

/**
 * プラグインコンテキストを使用するTreeTableCore
 * プラグインフックの実行をサポートします
 */
function TreeTableCoreWithPluginContext(props: TreeTableCoreProps) {
  // TODO: プラグインフックの統合を実装
  // 1. usePluginContextを使用してプラグインコンテキストを取得
  // 2. イベントハンドラーにプラグインフックを統合
  // 3. プラグインによるコンポーネントオーバーライドをサポート
  
  // 現時点では通常のTreeTableCoreをレンダリング
  // 実装が完了したら、ここでプラグインフックをpropsに注入
  return <TreeTableCoreOriginal {...props} />;
}

// =============================================================================
// Convenience Components (移行された旧TreeTableWithPluginsから)
// =============================================================================

/**
 * インライン編集機能付きTreeTable
 * @deprecated 代わりにTreeTableCoreWithPluginsとinlineEditPluginを使用してください
 */
export function InlineEditableTreeTable(props: TreeTableCorePropsWithPlugins) {
  // インライン編集プラグインをデフォルトで有効化
  const plugins = props.plugins || [];
  return (
    <TreeTableCoreWithPlugins
      {...props}
      enablePlugins={true}
      plugins={plugins}
    />
  );
}

/**
 * 高度なキーボードナビゲーション付きTreeTable
 * @deprecated 代わりにTreeTableCoreWithPluginsとkeyboardNavigationPluginを使用してください
 */
export function KeyboardNavigableTreeTable(props: TreeTableCorePropsWithPlugins) {
  // キーボードナビゲーションプラグインをデフォルトで有効化
  const plugins = props.plugins || [];
  return (
    <TreeTableCoreWithPlugins
      {...props}
      enablePlugins={true}
      plugins={plugins}
    />
  );
}

/**
 * 全機能付きTreeTable
 * @deprecated 代わりにTreeTableCoreWithPluginsとfullFeaturedPluginsを使用してください
 */
export function AdvancedTreeTable(props: TreeTableCorePropsWithPlugins) {
  // すべてのプラグインを有効化
  const plugins = props.plugins || [];
  return (
    <TreeTableCoreWithPlugins
      {...props}
      enablePlugins={true}
      plugins={plugins}
      debugPlugins={props.debugPlugins || false}
    />
  );
}

// デフォルトエクスポート
export default TreeTableCoreWithPlugins;