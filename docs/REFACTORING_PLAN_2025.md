# HierarchiDB リファクタリングプラン 2025

## 概要

HierarchiDBのコードベースにおける重複・不整合を解消し、責務を明確化するためのリファクタリング計画書。

## 現状の問題点

### 1. Registry層の重複
- `BaseNodeTypeRegistry.ts`が`runtime/worker`と`runtime/plugin-registry`の両方に存在
- `plugin-registry-api.ts`も同様に重複
- Worker側のregistryがプラグイン固有の実装を含んでいる

### 2. Handler層の責務混在
- Worker側にプラグイン固有のHandler実装が存在
  - `SpreadsheetWorkerHandler.ts`
  - `StylerWorkerHandler.ts`
- 本来プラグイン側で実装すべきものがWorker側に混在

### 3. Service層の整理不足
- プラグイン管理機能が分散
  - `NodeTypeService.ts`
  - `PluginManagementService.ts`
- 命名規則の不統一（Manager vs Service）
- プラグイン固有機能（TagService）がWorker側に存在

## リファクタリング方針

### 基本原則
1. **責務の明確化**: Worker層はコア機能、Plugin層は拡張機能
2. **重複の排除**: 同一機能の実装を一箇所に集約
3. **命名規則の統一**: 一貫性のある命名規則を適用
4. **依存関係の最適化**: 循環参照を避け、明確な依存関係を構築

## 実施計画

### Phase -3: plugin-baseの削除とbase-plugin/folder-plugin分離

#### 背景
- `packages/common/plugin-base`は中途半端な抽象化
- folder-pluginが実質的な共通機能プロバイダー
- 継承専用の基盤と、ユーザー向け機能を明確に分離すべき

#### 作業内容
1. **新規作成**: `packages/plugins/base-plugin/`
   - BaseEntityHandler（plugin-baseから移動）
   - HierarchicalEntityHandler（plugin-baseから移動）
   - 基本型定義

2. **folder-plugin整理**
   - base-pluginを継承
   - TagService（既存）
   - メタデータ操作（FolderEntityHandler内に簡潔に実装）
   - UIコンポーネント（既存）

3. **plugin-base削除**
   - `packages/common/plugin-base/`ディレクトリ全体を削除
   - 全参照をbase-pluginに更新

### Phase -2: PluginDefinitionにvisibilityフィールド追加

#### 作業内容
```typescript
// PluginDefinitionに追加
visibility?: {
  showInCreateMenu?: boolean;  // デフォルト: true
  showInPluginList?: boolean;  // デフォルト: true
};
```

#### 適用例
- base-plugin: 両方false（継承専用のため非表示）
- folder-plugin: 省略またはtrue（ユーザー向け）

### Phase -1: BaseEntity重複定義の統合

#### 作業内容
1. `packages/common/plugin-base/src/types/base-lifecycle-types.ts`のBaseEntity削除
2. `packages/common/types/src/entity-lifecycle-types.ts`の定義に統一
3. 全参照を更新

### Phase -1: 未使用パッケージの削除（新規追加）

#### 対象ファイル
- 削除: `packages/common/util/` ディレクトリ全体

#### 作業内容
1. packages/common/utilディレクトリを削除
2. pnpm-workspace.yamlから参照を削除（必要に応じて）

#### 理由
- ダミー実装のみ（`export function dummy() { // TODO: FIXME }`）
- どこからも参照されていない
- 不要なパッケージはメンテナンスコストを増やす

### Phase 0: BaseReferenceCountingHandlerの整理（新規追加）

#### 対象ファイル
- 削除: `packages/common/core/src/base/BaseReferenceCountingHandler.ts`（未使用）
- 移動: `packages/runtime/worker/src/handlers/ReferenceCountingHandler.ts`
  → `packages/common/plugin-base/src/handlers/BaseReferenceCountingHandler.ts`

#### 作業内容
1. common/coreの未使用実装を削除
2. worker側の実装をplugin-baseへ移動（プラグイン共通パターンとして）
3. SpreadsheetWorkerHandler、StylerWorkerHandlerの移動時に合わせて参照を修正

#### 理由
- 参照カウント機能はプラグイン共通パターン
- plugin-baseパッケージが適切な配置場所
- Worker層にプラグイン固有機能を置かない

### Phase 1: Registry層の重複解消

#### 対象ファイル
- 削除: `packages/runtime/worker/src/registry/BaseNodeTypeRegistry.ts`
- 削除: `packages/runtime/worker/src/registry/plugin-registry-api.ts`（重複）
- 移動: `packages/runtime/worker/src/registry/geographic-plugins.ts` → プラグイン側へ
- 移動: `packages/runtime/worker/src/registry/default-plugins.ts` → プラグイン側へ

#### 作業内容
1. Worker側の重複ファイルを削除
2. import文を`@hierarchidb/runtime-plugin-registry`からのインポートに変更
3. プラグイン固有のregistry実装をplugin-registry側へ移動

### Phase 2: Service層の命名規則統一

#### 対象ファイル
- 改名: `WorkingCopyManager.ts` → `WorkingCopyEntityService.ts`
- 改名: `EntityWorkingCopyManager.ts` → `EntityWorkingCopyService.ts`

#### 作業内容
1. ファイル名の変更
2. クラス名の変更
3. 全参照箇所の更新

### Phase 3: プラグイン管理機能の集約

#### 対象ファイル
- 移動: `packages/runtime/worker/src/services/NodeTypeService.ts` → `packages/runtime/plugin-registry/src/services/`
- 移動: `packages/runtime/worker/src/services/PluginManagementService.ts` → `packages/runtime/plugin-registry/src/services/`

#### 作業内容
1. 両サービスをplugin-registryへ移動
2. 機能の重複を統合
3. 統一されたプラグイン管理APIを提供

### Phase 4: TagServiceのプラグイン化

#### 対象ファイル
- 移動: `packages/runtime/worker/src/services/TagService.ts` → `packages/plugins/folder-plugin/src/services/`

#### 作業内容
1. TagServiceをfolder-pluginへ移動
2. folder-plugin内でタグ機能として統合
3. Worker側からタグ関連のコードを削除

### Phase 5: SpreadsheetWorkerHandlerの移動

#### 対象ファイル
- 移動: `packages/runtime/worker/src/handlers/SpreadsheetWorkerHandler.ts` → `packages/plugins/spreadsheet-plugin/src/handlers/`

#### 作業内容
1. SpreadsheetWorkerHandlerをspreadsheet-pluginへ移動
2. プラグイン内でのHandler登録を実装
3. Worker側の参照を削除

### Phase 6: StylerWorkerHandlerの移動

#### 対象ファイル
- 移動: `packages/runtime/worker/src/handlers/StylerWorkerHandler.ts` → `packages/plugins/styler-plugin/src/handlers/`

#### 作業内容
1. StylerWorkerHandlerをstyler-pluginへ移動
2. プラグイン内でのHandler登録を実装
3. Worker側の参照を削除

### Phase 7: BasePeerEntityHandlerの整理

#### 対象ファイル
- 移動: `packages/runtime/worker/src/handlers/BasePeerEntityHandler.ts` → 新規example-pluginパッケージへ

#### 作業内容
1. `packages/plugins/example-plugin`パッケージを作成
2. BasePeerEntityHandlerをサンプル実装として移動
3. テストコードも含めて移動

## 最終的な構造

### Worker層（コア機能のみ）
```
packages/runtime/worker/
├── src/
│   ├── handlers/
│   │   ├── BaseEntityHandler.ts         # 基底クラス
│   │   ├── PeerEntityHandler.ts         # 抽象クラス
│   │   ├── GroupEntityHandler.ts        # 抽象クラス
│   │   └── WorkingCopyHandler.ts        # コア機能
│   └── services/
│       ├── TreeQueryService.ts          # ツリー操作コア
│       ├── TreeMutationService.ts       # ツリー変更コア
│       ├── WorkingCopyEntityService.ts        # WorkingCopyコア（改名後）
│       └── TreeSubscriptionService.ts   # 購読管理コア
```

### Plugin-Registry層（プラグイン管理）
```
packages/runtime/plugin-registry/
├── src/
│   ├── registry/
│   │   ├── BaseNodeTypeRegistry.ts      # 基底クラス（唯一の実装）
│   │   └── PluginRegistryImpl.ts            # プラグイン管理
│   └── services/
│       ├── NodeTypeService.ts           # 移動・統合
│       └── PluginManagementService.ts   # 移動・統合
```

### Plugin層（拡張機能）
```
packages/plugins/
├── base-plugin/                  # 新規：継承専用基盤
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── BaseEntityHandler.ts
│   │   │   └── HierarchicalEntityHandler.ts
│   │   └── index.ts
│   └── package.json              # visibility: false設定
├── folder-plugin/
│   └── src/services/
│       └── TagService.ts                # タグ機能
├── spreadsheet-plugin/
│   └── src/handlers/
│       └── SpreadsheetHandler.ts        # スプレッドシート機能
├── styler-plugin/
│   └── src/handlers/
│       └── StylerHandler.ts           # スタイルマップ機能
└── example-plugin/                      # 新規作成
    └── src/handlers/
        └── BasePeerEntityHandler.ts     # サンプル実装
```

## 期待される効果

1. **責務の明確化**
   - Worker層: コア機能のみ
   - Plugin-Registry層: プラグイン管理
   - Plugin層: 各種拡張機能

2. **保守性の向上**
   - 重複コードの削除
   - 明確な依存関係
   - 一貫した命名規則

3. **拡張性の向上**
   - 新規プラグイン開発が容易
   - プラグイン間の独立性向上
   - テストしやすい構造

## リスクと対策

### リスク
1. 大規模な変更による一時的な不安定化
2. 既存のimport文の大量変更
3. テストコードの修正必要性

### 対策
1. Phase毎に段階的に実施
2. 各Phase完了時にテスト実行
3. 変更内容を詳細に文書化
4. git branchを活用した安全な作業

## アーキテクチャの最終形

### 削除されるパッケージ
1. `packages/common/plugin-base` → base-plugin/folder-pluginに分離
2. `packages/common/util` → 未使用のため削除
3. `packages/runtime/router` → 過剰実装のため削除

### 新規作成パッケージ
1. `packages/plugins/base-plugin` → 継承専用の基盤機能

### 主要な変更点
1. **plugin-baseの分離**
   - 継承専用: base-plugin（UIに表示されない）
   - ユーザー向け: folder-plugin（タグ等の機能含む）

2. **visibility制御**
   - PluginDefinitionに最小限のvisibilityフィールド追加
   - showInCreateMenu/showInPluginListのみ

3. **責務の明確化**
   - Worker層: コア機能のみ
   - Plugin層: 拡張機能
   - base-plugin: 継承用基盤
   - folder-plugin: 共通機能プロバイダー

## スケジュール目安

- Phase -3〜-1: 1日（基盤の再構築）
- Phase 0〜0.6: 1日（クリーンアップ）
- Phase 1-2: 1日（基本的な整理）
- Phase 3-4: 2日（サービス層の移動）
- Phase 5-7: 2日（Handler層の移動）
- テスト・調整: 1日

合計: 約1週間

## 追加の問題点と対策

### MetadataEntityHandlerの削除

### 現状の問題

`packages/common/plugin-base/src/handlers/MetadataEntityHandler.ts`の検証結果：

#### 1. 過剰な実装
- **customFields関連メソッド**（284-343行）
  - 実際のプラグインで使用されていない
  - metadata機能と重複
  
- **高度な検索機能**（348-379行）
  - `searchByMetadata`、`searchByTags`
  - 実際には各プラグインが独自実装

- **メタデータのマージ・コピー機能**（420-463行）
  - `mergeMetadata`、`copyMetadata`
  - 実際の使用例なし

#### 2. TagService重複
- MetadataEntityHandlerにタグ機能（195-279行）
- Worker側にTagService
- 実際の使用はfolder-pluginのみ

### 対策

#### Phase 0.5: MetadataEntityHandlerの削除

**作業内容：**
1. `packages/common/plugin-base/src/handlers/MetadataEntityHandler.ts`を削除
2. LocationPluginの修正
   - `LocationEntityHandler`を`BaseEntityHandler`直接継承に変更
   - 必要なメタデータ機能は型安全に独自実装
3. FolderPluginの修正
   - `MetadataEntityHandlerAdapter`を削除
   - タグ機能は独自実装として保持
4. RoutePluginの修正
   - `MetadataHandlerAdapter`を削除
   - 必要な機能のみ独自実装

### packages/runtime/routerの問題

**現状分析：**
- 過度に複雑な実装（500行以上）
- どこからも使用されていない
- プラグインルーティングの独自実装だが、実際のルーティングはapp層で実装済み

**対策：**

#### Phase 0.6: runtime/routerの削除または簡素化

**オプション1（推奨）：完全削除**
- パッケージ全体を削除
- 実際のルーティングはapp層で既に動作

**オプション2：最小限の実装に置き換え**
- 基本的なプラグイン型定義のみ残す
- 複雑なセキュリティ機能やパフォーマンス監視は削除

## 注意事項

1. 各Phaseの実施前に現在のブランチの状態を確認
2. 変更後は必ず`pnpm typecheck`と`pnpm build`を実行
3. 重要な変更は個別にコミット
4. 問題が発生した場合は即座にロールバック可能な状態を維持

---

*作成日: 2025-01-31*
*作成者: Claude Code Assistant*