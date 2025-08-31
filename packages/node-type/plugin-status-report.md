# プラグイン ビルド・型チェック状況レポート
生成日: 2024-08-31

## 概要
最新のプラグイン機構およびAPI、worker実装に対する各プラグインの互換性状況

## 状況サマリー

| プラグイン | TypeScriptエラー数 | 状態 | 主な問題 |
|-----------|-------------------|------|---------|
| **folder-plugin** | 109 | ❌ 要修正 | FolderEntity型定義の不整合、base-plugin参照エラー |
| **shape-plugin** | 12 | ⚠️ 軽微 | 比較的少ないエラー |
| **location-plugin** | 47 | ⚠️ 中程度 | shape-plugin依存関係 |
| **route-plugin** | 8 | ✅ 良好 | 軽微なエラーのみ |
| **basemap-plugin** | 15 | ⚠️ 軽微 | 型定義の調整が必要 |
| **stylemap-plugin** | 147 | ❌ 要修正 | 大規模な型エラー |
| **project-plugin** | 94 | ❌ 要修正 | 多数の型不整合 |
| **spreadsheet-plugin** | 242 | ❌ 深刻 | 最も多いエラー数 |
| **propertyresolver-plugin** | 17 | ⚠️ 軽微 | 型定義の調整が必要 |

## 主要な問題パターン

### 1. 共通の型定義エラー
- `@hierarchidb/common-plugin-base` が `@hierarchidb/base-plugin` に変更されたことによる参照エラー
- `FolderEntity`, `FolderEntityWorkingCopy` などの型がエクスポートされていない
- `tags` と `metadata` フィールドが削除されたことによる不整合

### 2. EntityハンドラーのAPI変更
- `createWorkingCopy`, `updateWorkingCopy`, `commitWorkingCopy`, `discardWorkingCopy` メソッドが削除
- `EntityId` と `NodeId` の型不一致
- `getEntity` の戻り値が `null` から `undefined` に変更

### 3. UI関連のエラー
- Grid コンポーネントの `item` プロパティエラー（MUI v6への移行が必要）
- `@hierarchidb/runtime-base-dialog` モジュールが見つからない
- `@hierarchidb/ui-core` モジュールが見つからない

### 4. プラグイン定義の不整合
- `NodeTypeDefinition` が削除され、新しいプラグイン定義構造への移行が必要
- `PluginMetadata` の構造変更
- 拡張メカニズムの変更

## 修正優先度

### 🔴 高優先度（基盤プラグイン）
1. **folder-plugin** - 最も基本的なプラグイン、他の多くが依存
2. **project-plugin** - プロジェクト管理の中核

### 🟡 中優先度（機能プラグイン）
3. **shape-plugin** - geographic系の基盤
4. **location-plugin** - shape-pluginに依存
5. **basemap-plugin** - 地図表示の基盤

### 🟢 低優先度（特殊機能）
6. **route-plugin** - 比較的独立
7. **stylemap-plugin** - スタイル定義
8. **spreadsheet-plugin** - 大規模修正が必要
9. **propertyresolver-plugin** - 特殊用途

## 推奨アクション

### 即座に実施すべき修正

1. **型定義のエクスポート修正**
```typescript
// packages/node-type/folder-plugin/src/types/index.ts
export * from '../entities/FolderEntity';
export * from './FolderEntityWorkingCopy';
```

2. **base-pluginへの参照更新**
```typescript
// 変更前
import { BaseEntityHandler } from '@hierarchidb/common-plugin-base';
// 変更後
import { BaseEntityHandler } from '@hierarchidb/base-plugin';
```

3. **削除されたフィールドの除去**
- すべての `tags` フィールドへの参照を削除
- すべての `metadata` フィールドへの参照を削除

### 段階的な移行戦略

#### フェーズ1: 基盤修正（1-2日）
- folder-pluginの完全修正
- 共通の型定義問題の解決
- base-plugin参照の一括更新

#### フェーズ2: 中核プラグイン修正（2-3日）
- project-plugin
- shape-plugin
- basemap-plugin

#### フェーズ3: 依存プラグイン修正（2-3日）
- location-plugin
- route-plugin
- stylemap-plugin

#### フェーズ4: 特殊プラグイン修正（3-4日）
- spreadsheet-plugin（最も複雑）
- propertyresolver-plugin

## 技術的債務

### 識別された技術的債務
1. **型定義の分散** - 各プラグインが独自の型定義を持ち、共通化されていない
2. **APIバージョニングの欠如** - 破壊的変更に対する移行パスがない
3. **テストカバレッジ不足** - リファクタリング時の影響範囲が予測困難
4. **ドキュメント不足** - API変更の影響が文書化されていない

### 推奨される改善

1. **共通型定義パッケージの作成**
```
@hierarchidb/plugin-types
  ├── base/
  ├── entity/
  ├── handler/
  └── ui/
```

2. **プラグインテンプレートの作成**
- 新規プラグイン作成時の雛形
- ベストプラクティスの実装例

3. **移行ガイドの作成**
- 破壊的変更のリスト
- 具体的な修正例
- 自動移行スクリプト

## 結論

現状では、すべてのプラグインが最新のアーキテクチャと互換性がない状態です。
特に以下の作業が急務：

1. **folder-pluginの修正を最優先**で実施（他プラグインの参考実装となる）
2. **共通の問題パターンを自動修正するスクリプト**の作成
3. **段階的な移行計画**に従った体系的な修正

推定作業量: 10-15人日（全プラグインの完全修正）