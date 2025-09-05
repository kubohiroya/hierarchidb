# DB/テーブル命名規約と改名対象（ワーカー主導）

作成日: 2025-09-05
目的: プラグイン横断で Dexie データベース名・テーブル名の統一ルールを定義し、既存実装の改名対象を洗い出す。

## 命名規約（提案）
- データベース名（Dexie('…')）
  - 固有DB（プラグイン専用・永続）: `PascalName + DB`（例: `ShapeDB`, `RouteDB`, `ProjectDB`, `BaseMapDB`）
  - エンティティ複合DB（peer/group/relations を束ねる汎用）: `kebab-case-nodeType + -entities`（短い nodeType 前提。例: `folder-entities`, `location-entities`, `spreadsheet-entities`）
- テーブル名（camelCase, 複数形）
  - Peer: `xxxEntities`（例: `shapeEntities`, `spreadsheetEntities`, `projects`, `routes`, `baseMaps`, `folders`）
  - WorkingCopy: `workingCopies`（Peer の複本）
  - Group: `groupEntities`
  - Relational: `relations`
  - 補助: 機能が明確な名詞の複数形（例: `rawFileMetadata`, `rowChunks`, `featureBuffers`, `vectorTiles`, `tileBuffers`, `cache`, `snapshots`, `analysisResults`, `routeCache`）

備考:
- nodeType は `-plugin` を廃し短い識別子へ統一（例: `location`）。エンティティ複合DB名は短い nodeType に追随。
- 既存DBの実名変更はマイグレーションを伴うため、段階導入（互換オープン→移行）を推奨。

## 現状→統一名 マッピング（改名対象）
- basemap-plugin
  - DB: `BaseMapDatabase` → `BaseMapDB`
  - Tables: `baseMaps`, `workingCopies`（OK）
  - 定義/実装: `packages/node-type/basemap-plugin/src/database/BaseMapDatabase.ts`
- folder-plugin
  - DB(複合): `folder-plugin-entities` → `folder-entities`
    - Tables: `peerEntities`, `groupEntities`, `relations`（OK）
    - 実装: `packages/node-type/folder-plugin/src/worker/folderEntitiesDB.ts`
  - DB(固有): `FolderDatabase` → `FolderDB`
    - Tables: `folders`, `workingCopies`（OK）
    - 実装: `packages/node-type/folder-plugin/src/database/FolderDatabase.ts`
- spreadsheet-plugin
  - DB(複合): `spreadsheet-plugin-entities` → `spreadsheet-entities`
    - 実装: `packages/node-type/spreadsheet-plugin/src/worker/spreadsheetEntitiesDB.ts`
  - DB(固有): `SpreadsheetDB`（OK）
    - 実装: `packages/node-type/spreadsheet-plugin/src/database/SpreadsheetDatabase.ts`
- styler-plugin
  - DB: `StylerCSVMetadata` → `StylerMetadataDB`（提案）
    - Table: `csvMetadata`（OK）
    - 実装: `packages/node-type/styler-plugin/src/services/SimpleTableMetadataManager.ts`
- shape-plugin
  - DB(固有): `ShapeDB`（OK）
  - Ephemeral: `EphemeralShapeDB`（OK）
  - Tables: `shapeEntities`, `batchSessions`, `batchTasks`, `features`, `featureIndices`, `featureBuffers`, `vectorTiles`, `tileBuffers`, `cache`（OK）
  - 実装: `packages/node-type/shape-plugin/src/services/database/ShapeDB.ts` / `.../EphemeralShapeDB.ts`
- location-plugin
  - DB(複合): `location-plugin-entities` → `location-entities`
    - 実装: `packages/node-type/location-plugin/src/worker/locationEntitiesDB.ts`
- route-plugin
  - DB: `RouteDB`（OK）
  - Tables: `routes`, `workingCopies`, `routeCache`（OK）
  - 実装: `packages/node-type/route-plugin/src/database/RouteDatabase.ts`
- resolver-plugin
  - DB: `ResolverDB`（OK）
  - Tables: `resolvers`, `workingCopies`（OK）
  - 実装: `packages/node-type/resolver-plugin/src/database/ResolverDatabase.ts`
- project-plugin
  - DB: `ProjectPluginDB` → `ProjectDB`
  - Tables: `projects`, `snapshots`, `analysisResults`, `tiles`（OK）
  - 実装: `packages/node-type/project-plugin/src/database/project-database.ts`

## 実施手順（段階導入）
1) 命名規約の確定（本ドキュメント）
2) 互換オープンの導入（旧名で open → 新名へコピー or 二重オープンで移行）
3) nodeType の短縮化（`*-plugin` → 短名）と合わせて複合DB名を改名
4) UI/Worker の参照更新、ストア登録名の整合
5) マイグレーションとロールバック手順の文書化

### 互換オープンの例（疑似コード）
```ts
const db = new Dexie('BaseMapDB');
try { await db.open(); }
catch {
  const legacy = new Dexie('BaseMapDatabase');
  await legacy.open();
  // データ移行 or 以後は legacy 名で運用（段階移行）
}
```

## チェックリスト（各パッケージ）
- [ ] basemap: DB名改名（BaseMapDatabase→BaseMapDB）、参照置換、互換オープン
- [ ] folder: 複合DB名改名（folder-plugin-entities→folder-entities）、固有DB名（FolderDatabase→FolderDB）
- [ ] spreadsheet: 複合DB名改名（spreadsheet-plugin-entities→spreadsheet-entities）
- [ ] styler: DB名改名（StylerCSVMetadata→StylerMetadataDB）
- [ ] location: 複合DB名改名（location-plugin-entities→location-entities）
- [ ] project: DB名改名（ProjectPluginDB→ProjectDB）
- [ ] route/resolver/shape: 命名は現状維持（OK）

## ロールバック
- 互換オープンを残したまま新名への切替コミットをリバートすれば即時復旧可能。データ移行を伴う場合はバックアップ/コピーを必須とする。
