# TreeTable Plugin System Integration

## 概要

TreeTableCoreにオプショナルなプラグインサポートを追加したTreeTableCoreWithPluginsにより、後方互換性を維持しながら段階的にプラグイン機能を導入できるようになりました。

## 使用方法

### 1. 従来通りの使用（プラグインなし）

```tsx
import { TreeTableCore } from '@hierarchidb/ui-treeconsole-treetable';

// 従来通りの使用方法 - 完全に後方互換
<TreeTableCore
  controller={controller}
  viewHeight={600}
  selectionMode="multiple"
/>
```

### 2. プラグインを有効化（新しい統合版）

```tsx
import { TreeTableCoreWithPlugins } from '@hierarchidb/ui-treeconsole-treetable';
import { defaultPlugins } from '@hierarchidb/ui-treeconsole-treetable';

// プラグイン機能を有効化
<TreeTableCoreWithPlugins
  controller={controller}
  viewHeight={600}
  selectionMode="multiple"
  enablePlugins={true}
  plugins={defaultPlugins}
/>
```

### 3. カスタムプラグインの使用

```tsx
import { 
  TreeTableCoreWithPlugins,
  createInlineEditPlugin,
  createKeyboardNavigationPlugin 
} from '@hierarchidb/ui-treeconsole-treetable';

// カスタム設定でプラグインを作成
const customInlineEdit = createInlineEditPlugin({
  enableDoubleClickEdit: false,
  editStartKey: 'Enter',
  validateBeforeSave: async (node, newValue) => {
    // カスタム検証ロジック
    return newValue.length > 0;
  }
});

const customKeyboardNav = createKeyboardNavigationPlugin({
  enableArrowKeyNavigation: true,
  enableSelectAll: false,
});

// 使用
<TreeTableCoreWithPlugins
  controller={controller}
  viewHeight={600}
  enablePlugins={true}
  plugins={[customKeyboardNav, customInlineEdit]}
  debugPlugins={true} // デバッグモードを有効化
/>
```

## 利用可能なプラグイン

### 1. InlineEditPlugin
- **機能**: インライン編集機能
- **設定可能項目**:
  - `editStartKey`: 編集開始キー（デフォルト: F2）
  - `confirmKey`: 確定キー（デフォルト: Enter）
  - `cancelKey`: キャンセルキー（デフォルト: Escape）
  - `enableDoubleClickEdit`: ダブルクリックで編集（デフォルト: true）
  - `validateBeforeEdit`: 編集前検証
  - `validateBeforeSave`: 保存前検証

### 2. KeyboardNavigationPlugin
- **機能**: キーボードナビゲーション機能
- **設定可能項目**:
  - `enableArrowKeyNavigation`: 矢印キーでナビゲーション（デフォルト: true）
  - `enableSpaceKeySelection`: Spaceで選択トグル（デフォルト: true）
  - `enableSelectAll`: Ctrl+Aで全選択（デフォルト: true）
  - `enableRangeSelection`: Shift+矢印で範囲選択（デフォルト: true）
  - `enableExpandCollapseKeys`: 左右矢印で展開/折りたたみ（デフォルト: true）

## プラグイン開発

### カスタムプラグインの作成

```tsx
import { createPlugin } from '@hierarchidb/ui-treeconsole-treetable';

const myCustomPlugin = createPlugin(
  'my-plugin',
  '1.0.0',
  {
    // フック定義
    onRowClick: (node, event) => {
      console.log('Row clicked:', node.id);
      // trueを返すとデフォルトの動作を防ぐ
      return false;
    },
    
    onBeforeNodeUpdate: async (nodeId, newData) => {
      // 更新前の検証
      return true; // trueで更新を許可
    },
    
    onPluginInit: () => {
      console.log('Plugin initialized');
    }
  },
  {
    // オプション設定
    config: { customOption: 'value' },
    dependencies: ['other-plugin'],
  }
);
```

## 移行ガイド

### Phase 1: 評価（現在）
```tsx
// オプトイン方式でプラグインを試す
<TreeTableCoreWithPlugins
  {...props}
  enablePlugins={false} // デフォルトは無効
/>
```

### Phase 2: 段階的導入
```tsx
// 特定の機能だけプラグインで追加
<TreeTableCoreWithPlugins
  {...props}
  enablePlugins={true}
  plugins={[keyboardNavigationPlugin]}
/>
```

### Phase 3: 完全移行
```tsx
// すべての機能をプラグインベースに
<TreeTableCoreWithPlugins
  {...props}
  enablePlugins={true}
  plugins={fullFeaturedPlugins}
/>
```

## API リファレンス

### TreeTableCoreWithPlugins Props

| プロパティ | 型 | デフォルト | 説明 |
|---------|---|---------|------|
| `enablePlugins` | `boolean` | `false` | プラグインシステムを有効化 |
| `plugins` | `TreeTablePlugin[]` | `[]` | 使用するプラグインの配列 |
| `pluginConfig` | `TreeTablePluginConfig` | - | プラグインの設定 |
| `onPluginEvent` | `(event: PluginEvent) => void` | - | プラグインイベントリスナー |
| `debugPlugins` | `boolean` | `false` | デバッグモードを有効化 |

※ その他のプロパティはTreeTableCoreと同じ

## 今後の予定

1. **追加プラグイン開発**:
   - DragDropPlugin: ドラッグ&ドロップ機能
   - ContextMenuPlugin: コンテキストメニュー拡張
   - VirtualScrollPlugin: 仮想スクロール最適化
   - SearchPlugin: 検索機能
   - FilterPlugin: フィルタリング機能

2. **プラグインAPI安定化**:
   - TypeScript型定義の改善
   - プラグイン間通信の実装
   - ライフサイクルフックの拡充

3. **パフォーマンス最適化**:
   - プラグインの遅延読み込み
   - 不要なレンダリング防止
   - メモリ使用量の最適化