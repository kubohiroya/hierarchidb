# プラグイン移行タスク

## 概要

アーキテクチャリファクタリング後、全プラグインパッケージで型エラーが発生している状況を修正するための作業計画です。各プラグインを新しい`@hierarchidb/node-type-base-plugin`アーキテクチャに移行し、削除されたmetadata/tagsフィールドに依存しない構造に変更します。

## 共通修正方針

### 全プラグイン共通の作業項目

1. **パッケージ依存関係の更新**
   ```json
   // package.json の dependencies を更新
   "@hierarchidb/common-plugin-base": "workspace:*"  // 削除
   "@hierarchidb/node-type-base-plugin": "workspace:*"  // 追加
   ```

2. **import文の修正**
   ```typescript
   // 修正前
   import { MetadataEntityHandler } from '@hierarchidb/common-plugin-base';
   
   // 修正後  
   import { HierarchicalEntityHandler } from '@hierarchidb/node-type-base-plugin';
   ```

3. **Entity定義の簡略化**
   ```typescript
   // 修正前
   export interface MyEntity extends BaseEntity {
     metadata?: Record<string, any>;  // 削除
     tags?: string[];                 // 削除  
     // ...他のフィールド
   }
   
   // 修正後
   export interface MyEntity extends BaseEntity {
     // metadata, tags フィールドは完全削除
     // ...他のフィールドのみ保持
   }
   ```

4. **EntityHandler基底クラスの変更**
   ```typescript
   // 修正前
   export class MyEntityHandler extends MetadataEntityHandler<...> {
   
   // 修正後（階層構造が必要な場合）
   export class MyEntityHandler extends HierarchicalEntityHandler<...> {
   
   // 修正後（階層構造が不要な場合）  
   export class MyEntityHandler extends BaseEntityHandler<...> {
   ```

5. **metadata/tags関連コードの削除**
   - `setMetadata()`, `getMetadata()`, `addTag()`, `removeTag()` メソッドの削除
   - metadata/tags に依存する検索・フィルタリング機能の削除
   - buildEntity()内でのmetadata/tags初期化コードの削除

## 個別プラグイン修正指示

### タスク1: folder-plugin の修正

**対象**: `packages/node-type/folder-plugin`

**具体的な修正手順**:

1. `src/handlers/FolderEntityHandler.ts`の修正
   - MetadataEntityHandlerAdapterクラス全体を削除
   - FolderEntityExtended インターフェースからMetadataEntity継承を削除
   - buildEntity()メソッドからmetadata, tagsフィールド初期化を削除
   - metadata関連のdelegationメソッド（setMetadata, getMetadata等）を削除

2. `src/entities/FolderEntity.ts`の修正
   - metadata, tagsフィールドを型定義から完全削除

3. `src/types/index.ts`の修正
   - MetadataSearchCriteria継承を削除
   - FolderSearchCriteriaをHierarchicalSearchCriteriaのみ継承に変更

4. `package.json`の修正
   - `@hierarchidb/common-plugin-base`依存関係を削除
   - `@hierarchidb/node-type-base-plugin`依存関係を追加

### タスク2: shape-plugin の修正

**対象**: `packages/node-type/shape-plugin`

**具体的な修正手順**:

1. `src/definitions/ShapePluginDefinition.ts`の修正
   - import文を新しいパッケージに変更
   - プラグイン定義の構造を新しい型に合わせて調整

2. EntityHandlerがある場合の修正
   - 基底クラスをBaseEntityHandlerまたはHierarchicalEntityHandlerに変更
   - metadata/tags関連機能を削除

### タスク3: location-plugin の修正

**対象**: `packages/node-type/location-plugin`

**具体的な修正手順**:

1. `src/entities/LocationEntity.ts`の修正
   - metadata, tagsフィールドを削除
   - 座標情報(latitude, longitude等)は維持
   - 地理的属性は直接フィールドとして定義

2. `src/entities/LocationEntityHandler.ts`の修正
   - MetadataEntityHandlerの継承を削除
   - BaseEntityHandlerまたはHierarchicalEntityHandlerに変更
   - 地理データの検索・フィルタリング機能をmetadata依存から直接フィールド参照に変更

### タスク4: route-plugin の修正

**対象**: `packages/node-type/route-plugin`

**具体的な修正手順**:

1. `src/entities/RouteEntity.ts`の修正
   - metadata, tagsフィールドを削除  
   - ルート属性(距離、時間等)は直接フィールドとして定義

2. `src/entities/RouteEntityHandler.ts`の修正
   - 基底クラスの変更
   - ルート計算ロジックのmetadata依存を排除

### タスク5: basemap-plugin の修正

**対象**: `packages/node-type/basemap-plugin`

**具体的な修正手順**:

1. エンティティ定義の簡略化
   - マップレイヤー設定をmetadataではなく直接フィールドに
   - レイヤー可視性、透明度等の設定を構造化

2. ハンドラークラスの修正
   - マップ関連の設定管理をシンプルなフィールドアクセスに変更

### タスク6: project-plugin の修正

**対象**: `packages/node-type/project-plugin`

**具体的な修正手順**:

1. プロジェクト管理機能の再設計
   - プロジェクト設定、権限管理をmetadataから直接フィールドに移行
   - 階層構造が必要な場合はHierarchicalEntityHandlerを使用

2. プロジェクト固有の機能
   - メンバー管理、タスク管理等の機能をシンプルなエンティティ構造に変更

### タスク7: stylemap-plugin の修正

**対象**: `packages/node-type/stylemap-plugin`

**具体的な修正手順**:

1. スタイル設定の構造化
   - スタイル情報をmetadataから専用フィールドに移行
   - レンダリング設定、色設定等を型安全なフィールドに

2. レンダリングパイプライン
   - スタイル適用ロジックを新しいフィールド構造に対応

### タスク8: propertyresolver-plugin の修正

**対象**: `packages/node-type/propertyresolver-plugin`

**具体的な修正手順**:

1. プロパティ解決ロジック
   - 動的プロパティアクセスをmetadataから専用仕組みに変更
   - 型安全性を保ったプロパティ管理システムに移行

### タスク9: spreadsheet-plugin の修正

**対象**: `packages/node-type/spreadsheet-plugin`

**具体的な修正手順**:

1. セル管理システム
   - セルデータ、数式、書式設定をmetadataから専用構造に
   - 計算エンジンの依存関係を整理

2. スプレッドシート機能
   - 行・列管理、範囲選択等の機能を新しいアーキテクチャに適応
   - データ永続化の仕組みを見直し

## 作業完了後の検証方法

### 各プラグイン修正後の確認手順

1. **型チェック実行**
   ```bash
   # 特定プラグインの型チェック
   pnpm --filter @hierarchidb/node-type-folder-plugin typecheck
   
   # 全体の型チェック  
   pnpm typecheck
   ```

2. **ビルドテスト**
   ```bash
   # 特定プラグインのビルド
   pnpm --filter @hierarchidb/node-type-folder-plugin build
   
   # 全体ビルド
   pnpm build
   ```

3. **プラグイン登録テスト**
   - アプリケーション起動時にプラグインがエラーなく登録されること
   - 新しいノード作成時にプラグインが選択肢として表示されること

### 全プラグイン修正完了後の統合テスト

1. **全体型チェック**: すべてのTypeScriptエラーが0件
2. **全体ビルド**: エラーなしで完了  
3. **プラグイン機能テスト**: 各プラグインの基本機能が正常動作
4. **レグレッションテスト**: 既存機能に影響がないことを確認

## 注意事項

### 作業時の重要ポイント

- **metadata/tagsフィールドは完全削除**: 部分的な削除は型エラーの原因
- **検索・フィルタリング機能**: metadata依存の機能は代替実装が必要
- **後方互換性**: 既存データとの互換性を考慮した移行が必要
- **テストの実行**: 修正後は必ず型チェックとビルドを実行

### トラブルシューティング

- 型エラーが残る場合は、deleted imports や missing dependencies を確認
- ビルドエラーの場合は、export/import の整合性を確認
- 実行時エラーの場合は、undefined methods や missing properties を確認
