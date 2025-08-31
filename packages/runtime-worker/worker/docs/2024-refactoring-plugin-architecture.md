# 2024年 プラグインアーキテクチャ リファクタリング

## 概要
2024年8月31日に実施した大規模なプラグインアーキテクチャのリファクタリング作業の記録。
主な目的は、過剰に設計された部分の簡素化と、重複コードの削除。

## 主要な変更

### 1. plugin-baseパッケージの分割
**変更前**: `@hierarchidb/common-plugin-base` - UIと継承の両方を含む混在したパッケージ

**変更後**: `@hierarchidb/base-plugin` - 継承専用のベースクラスパッケージ
- BaseEntityHandler: エンティティ操作の基本クラス
- HierarchicalEntityHandler: 階層構造を持つエンティティ用
- UI表示なし（visibility設定でcreateMenuとpluginListから除外）

### 2. MetadataEntityHandlerの完全削除
**理由**: 
- 過剰に設計されたアブストラクション
- 実際にはタグ機能（TagAPI）で十分
- 各プラグインが独自にmetadataフィールドを定義すれば良い

**影響を受けたパッケージ**:
- folder-plugin: MetadataEntityHandlerAdapterクラスを削除
- すべてのmetadata/tagsフィールドを削除

### 3. 重複実装の削除

#### SimpleEntityHandler.ts
- BasePeerEntityHandlerと完全に重複していた実装を削除
- 参照箇所をBasePeerEntityHandlerに置き換え

#### geographic-plugins.ts
- 中央集権的なプラグイン登録ファイルを削除
- 各プラグインが自己完結型で登録する設計に変更

#### NodeDefinitionRegistry.ts
- PluginRegistryと機能が重複していたため削除
- deprecatedな実装

### 4. 型定義の整理

#### PluginMetadataの移動
**変更前**: runtime-worker内でローカル定義
**変更後**: `@hierarchidb/common-type/plugin-metadata.ts`

```typescript
export interface PluginMetadata {
  id: string;
  name: string;
  nodeType: NodeType;
  status: 'active' | 'inactive' | 'error';
  version: string;
  tags?: string[];
}
```

#### EntityHandlerContextの修正
groupフィールドをオプショナルに変更（すべてのノードタイプがGroupEntityを持つわけではない）

### 5. プラグイン定義の標準化

すべてのプラグインに必須プロパティを追加：
- `version`: セマンティックバージョニング
- `dependencies`: 依存プラグインのリスト
- `priority`: 読み込み優先度

## エラー削減の成果

| フェーズ | TypeScriptエラー数 | 削減率 |
|---------|-----------------|--------|
| 初期状態 | 約200個 | - |
| フェーズ1完了 | 86個 | 57% |
| フェーズ2完了 | 72個 | 64% |
| フェーズ3完了 | 66個 | 67% |
| 最終状態 | 40個 | 80% |

## 残作業

### ビルドエラーの完全解消
1. base-pluginパッケージのインポートパス問題
2. テストファイルの更新（約20個のエラー）

### 推奨される追加作業
1. 循環依存のチェックと解消
2. geographic系プラグイン（shape, location, route）のPluginDefinitionエクスポート
3. tsconfig.jsonの`skipLibCheck: false`での完全ビルド

## アーキテクチャの改善点

### Before
```
plugin-base (混在)
  ├── BaseEntityHandler
  ├── MetadataEntityHandler (過剰)
  ├── UIコンポーネント
  └── 複雑な依存関係
```

### After
```
base-plugin (継承専用)
  ├── BaseEntityHandler
  └── HierarchicalEntityHandler

各プラグイン (自己完結)
  ├── EntityHandler (BaseまたはHierarchicalを継承)
  ├── PluginDefinition
  └── 独自の機能
```

## 設計原則

1. **シンプルさ優先**: 過剰な抽象化を避ける
2. **自己完結型プラグイン**: 各プラグインが独立して動作
3. **明確な責任分離**: 継承用とユーザー向けの明確な区別
4. **型安全性**: ブランド型（NodeId, EntityId等）の一貫した使用

## 教訓

1. **早期の過剰設計を避ける**: MetadataEntityHandlerのような汎用的すぎる抽象化は、実際の要件が明確になるまで避ける
2. **重複を許容する場合もある**: 完全なDRYよりも、明確さと保守性を優先
3. **段階的なリファクタリング**: 一度にすべてを修正しようとせず、段階的に進める
4. **ドキュメント化の重要性**: 大規模な変更は必ず記録を残す

## 関連ファイル

- `/packages/node-type/base-plugin/` - 新しい継承専用パッケージ
- `/packages/runtime/worker/src/registry/plugin.ts` - プラグイン定義
- `/packages/common/types/src/plugin-metadata.ts` - メタデータ型定義
- `/packages/common/types/src/plugin-definition.ts` - プラグイン定義型

## 作業者
- 実施日: 2024年8月31日
- Claude Code による自動リファクタリング