# BaseMap Plugin Migration Plan

## 概要

basemap-pluginをfolder-pluginの拡張として、新しいbase-pluginアーキテクチャに移行する計画書です。

**重要**: このプラグインはfolder-pluginにパッケージレベルで依存し、その実装内容を最大限に活用するため、**folder-pluginの移行が完了してから**この移行作業に着手する必要があります。

## 現状分析

### 1. 依存関係
- **folder-pluginの状態**: 未移行（109個のTypeScriptエラー）
- **basemap-pluginの依存**: `@hierarchidb/plugins-folder-plugin`に依存
- **base-pluginの依存**: `@hierarchidb/plugins-base-plugin`への移行が必要

### 2. 現在の実装構造
```
packages/plugins/basemap-plugin/
├── src/
│   ├── handlers/
│   │   └── BaseMapEntityHandler.ts (FolderEntityHandlerを継承)
│   ├── entities/
│   ├── definitions/
│   ├── components/
│   ├── database/
│   ├── types/
│   └── extension/ (レガシー互換用)
└── package.json
```

### 3. 主要な問題点
- FolderEntityHandlerが新しいHierarchicalEntityHandlerへの移行未完了
- 古いWorking Copyパターンの使用
- 削除されたフィールド（tags, metadata）への参照
- 型定義の不整合

## 移行計画

### フェーズ1: 前提条件の確認（待機中）
**期間**: folder-plugin移行完了まで待機

1. folder-pluginの移行完了を確認
2. FolderEntityHandlerが新しいHierarchicalEntityHandlerを適切に継承していることを確認
3. folder-pluginのビルドが成功することを確認

### フェーズ2: 型定義とインターフェースの更新
**期間**: 1日

1. **BaseMapEntity型の更新**
   - HierarchicalEntityを継承するよう変更
   - 不要なフィールド（tags, metadata）の削除
   - 新しい型システムへの適応

2. **WorkingCopy型の更新**
   - 新しいWorkingCopyインターフェースへの適応
   - isDraft, originalIdなどの新フィールドの追加

### フェーズ3: ハンドラーの実装更新
**期間**: 1-2日

1. **BaseMapEntityHandlerの更新**
   ```typescript
   export class BaseMapEntityHandler extends FolderEntityHandler<
     BaseMapEntity,
     BaseMapWorkingCopy,
     CreateBaseMapData,
     BaseMapSearchCriteria
   > {
     // 新しいAPIに合わせた実装
   }
   ```

2. **メソッドの更新**
   - `createEntity` → 新しいシグネチャへ
   - `updateEntity` → 部分更新のサポート
   - `getEntityByNodeId` → 新しいヘルパーメソッドの使用
   - Working Copy関連メソッドの削除または更新

3. **BaseMap固有メソッドの保持**
   - `updateMapStyle`
   - `updateViewport`
   - `updateDisplayOptions`
   - `validateConfiguration`
   - `searchBaseMaps`

### フェーズ4: データベース層の更新
**期間**: 0.5日

1. **BaseMapDatabaseの更新**
   - 新しいエンティティ構造への対応
   - インデックスの最適化
   - マイグレーション処理の実装

### フェーズ5: UIコンポーネントの更新
**期間**: 1日

1. **ダイアログコンポーネント**
   - MapStyleStep
   - MapViewportStep
   - DisplayOptionsStep
   - PreviewStep

2. **表示コンポーネント**
   - BaseMapDisplay
   - BaseMapPanel
   - BaseMapPreview

3. **フックの更新**
   - useBaseMapEntity

### フェーズ6: テストとビルドの修正
**期間**: 1日

1. **テストファイルの更新**
   - 新しいAPIに合わせたテストケースの修正
   - モックデータの更新

2. **ビルドエラーの解決**
   - TypeScriptエラーの修正
   - 依存関係の解決

3. **統合テスト**
   - folder-pluginとの連携確認
   - 他のプラグインとの互換性確認

## 実装の詳細

### 1. 新しい型定義
```typescript
// BaseMapEntity.ts
import type { NodeId } from '@hierarchidb/common-type';
import type { FolderEntity } from '@hierarchidb/plugin-loader-folder-plugin';

export interface BaseMapEntity extends FolderEntity {
  // BaseMap固有のフィールド
  mapStyle: MapStyle;
  viewport: MapViewport;
  displayOptions: DisplayOptions;
  baseMapMetadataId?: string;
}

export interface BaseMapWorkingCopy extends BaseMapEntity {
  isDraft: true;
  originalId?: string;
  copiedAt: number;
}
```

### 2. ハンドラーの実装パターン
```typescript
export class BaseMapEntityHandler extends FolderEntityHandler<
  BaseMapEntity,
  BaseMapWorkingCopy,
  CreateBaseMapData,
  BaseMapSearchCriteria
> {
  protected table = this.coreDB.table<BaseMapEntity>('baseMaps');
  protected workingCopyTable = this.ephemeralDB.table<BaseMapWorkingCopy>('baseMapWorkingCopies');

  // 実装は基底クラスのメソッドをオーバーライド
  protected async createEntityData(nodeId: NodeId, data?: CreateBaseMapData): Promise<BaseMapEntity> {
    const folderData = await super.createEntityData(nodeId, data);
    return {
      ...folderData,
      mapStyle: data?.mapStyle || DEFAULT_MAP_STYLE,
      viewport: data?.viewport || DEFAULT_VIEWPORT,
      displayOptions: data?.displayOptions || DEFAULT_DISPLAY_OPTIONS,
    };
  }
}
```

## リスクと対策

### リスク1: folder-pluginの実装変更
- **対策**: folder-plugin移行完了後に再度実装を確認

### リスク2: 破壊的変更による既存データの互換性問題
- **対策**: マイグレーション処理の実装

### リスク3: UIコンポーネントの大幅な変更
- **対策**: 段階的な移行とレガシー互換層の維持

## 成功基準

1. **ビルド成功**: TypeScriptエラーが0件
2. **テスト合格**: 全てのユニットテストが成功
3. **機能維持**: 既存の全機能が動作
4. **パフォーマンス**: folder-pluginと同等以上のパフォーマンス
5. **拡張性**: 将来的な機能追加が容易

## タイムライン

1. **現在**: folder-plugin移行待ち
2. **folder-plugin完了後 Day 1-2**: 型定義とハンドラーの更新
3. **Day 3**: データベース層とUIコンポーネントの更新
4. **Day 4**: テストとビルドの修正
5. **Day 5**: 最終確認とドキュメント更新

## 次のステップ

1. folder-pluginの移行状況を定期的に確認
2. folder-plugin完了後、即座に移行作業を開始
3. 移行中は随時進捗を更新

## 参考資料

- [Base Plugin Architecture](../packages/plugins/base-plugin/README.md)
- [Folder Plugin Migration](./folder-plugin-migration.md)
- [Plugin Status Report](../packages/plugins/plugin-status-report.md)