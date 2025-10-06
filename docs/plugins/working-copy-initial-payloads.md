# PeerEntity Working Copy Defaults

本ドキュメントでは、ツリーノードを新規作成する際に各プラグインの PeerEntity（ワーキングコピー／ドラフト）がどのような初期値で生成されるかを JSON 形式で整理する。記述している値はリポジトリ内の実装値をそのまま反映しており、タイムスタンプなどの実行時に決定する値はコメントで補足した。

Working Copy と PeerStore の初期化は `@hierarchidb/plugins-base-plugin` が提供する `createDraftWorkingCopyBase`／`createPeerStoreNormalizer` で段階的に統一する方針であり、今後はここに記載した既定値をそれらのヘルパーへ実装していく予定である。

> 最終更新: 2025-10-05

## folder (`nodeType: "folder"`)

PeerStore には `normalizeFolderPeerData` が適用され、未設定時は以下のデータが書き込まれる。

参照: `packages/plugins/folder-plugin/src/worker/folderPeerStore.ts`

```json
{
  "schemaVersion": 1,
  "domain": {}
}
```

フォルダは PeerEntity 側で追加メタデータを持たないため、ワーキングコピー作成時に特別な初期化ロジックは存在しない（TreeNode 側の draft ノードに名称や holder 情報が埋め込まれるのみ）。

## basemap (`nodeType: "basemap"`)

### PeerStore 初期値

参照: `packages/plugins/basemap-plugin/src/worker/basemapPeerStore.dexie.ts`

```json
{
  "schemaVersion": 1,
  "presentation": null,
  "metadata": {}
}
```

### Working Copy ドラフト

参照: `packages/plugins/basemap-plugin/src/handlers/BaseMapEntityHandler.ts`

```json
{
  "name": "New BaseMap",
  "description": "",
  "settings": {
    "allowNestedFolders": true,
    "maxDepth": 10,
    "sortOrder": "name"
  },
  "mapStyle": {
    "style": "streets"
  },
  "viewport": {
    "center": [0, 0],
    "zoom": 2,
    "bearing": 0,
    "pitch": 0
  },
  "displayOptions": {
    "show3dBuildings": false,
    "showTraffic": false,
    "showTransit": false,
    "showTerrain": false,
    "showLabels": true
  },
  "tags": []
}
```

`createdAt` / `updatedAt` などのタイムスタンプ、および holder 情報は実行時に付与される。`mapStyle` や `displayOptions` は `normalizeMapStyle` / `resolveDisplayOptions` の既定値（`streets` スタイル）から生成される。

## location (`nodeType: "location"`)

### PeerStore 初期値

参照: `packages/plugins/location-plugin/src/worker/normalizers.ts`

```json
{
  "schemaVersion": 1,
  "lastProgress": null,
  "lastError": null,
  "metadata": {}
}
```

### Working Copy ドラフト

参照: `packages/plugins/location-plugin/src/entities/LocationEntityHandler.ts`

```json
{
  "name": "",
  "category": "infrastructure",
  "type": "airport",
  "dataSource": "openstreetmap",
  "point": {
    "coordinates": [0, 0],
    "source": "manual",
    "timestamp": "<now>"
  },
  "licenseAgreement": false,
  "selectedCountries": [],
  "selectedTypes": [],
  "checkboxState": {},
  "searchRadius": 1000,
  "maxResults": 100,
  "metadata": {},
  "customFields": {},
  "childLocationIds": [],
  "nearbyLocationIds": [],
  "searchKeywords": []
}
```

`copiedAt` / `createdAt` / `updatedAt` / `treeNodeId` などの識別子系プロパティは実行時に付与される。地理的情報と UI 用の初期値を包括的にセットするのが特徴。

## shape (`nodeType: "shape"`)

### PeerStore 初期値

参照: `packages/plugins/shape-plugin/src/worker/shapePeerStore.dexie.ts`

```json
{
  "schemaVersion": 1,
  "lastProcessedTile": null,
  "metadata": {}
}
```

### Working Copy ドラフト

参照: `packages/plugins/shape-plugin/src/worker/handlers/ShapeEntityHandler.ts`

```json
{
  "name": "",
  "dataSourceName": "naturalearth",
  "licenseAgreement": false,
  "processingConfig": "<DEFAULT_PROCESSING_CONFIG>",
  "checkboxState": "",
  "selectedCountries": [],
  "adminLevels": [],
  "urlMetadata": [],
  "isDraft": true
}
```

`DEFAULT_PROCESSING_CONFIG` は形状生成に利用するエンジン設定の定数で、リゾルバや再投影のデフォルトが含まれる。ID 系フィールド（`id`, `nodeId`, `parentId` 等）は作成時に割り当てられる。

## spreadsheet (`nodeType: "spreadsheet"`)

PeerStore の正規化のみが定義されており、ワーキングコピー専用のドラフト初期化はまだ実装されていない。新規ノード作成時は以下のデータが保存される。

参照: `packages/plugins/spreadsheet-plugin/src/worker/spreadsheetPeerStore.dexie.ts`

```json
{
  "schemaVersion": 1,
  "lastViewedSheet": null,
  "metadata": {}
}
```

## route (`nodeType: "route"`)

PeerStore はルート計算の再実行メタを保持するだけで、ドラフト組み立ては UI 側で行われる。

参照: `packages/plugins/route-plugin/src/worker/routePeerStore.dexie.ts`

```json
{
  "schemaVersion": 1,
  "lastComputedAt": null,
  "metadata": {}
}
```

## resolver (`nodeType: "resolver"`)

Resolver プラグインは既存エンティティのコピーとしてワーキングコピーを生成する（新規ドラフトをゼロから組み立てる API は未実装）。PeerStore は以下の既定で初期化される。

参照: `packages/plugins/resolver-plugin/src/worker/resolverPeerStore.dexie.ts`

```json
{
  "schemaVersion": 1,
  "lastExecutedAt": null,
  "metadata": {}
}
```

## styler (`nodeType: "styler"`)

参照: `packages/plugins/styler-plugin/src/worker/stylerPeerStore.dexie.ts`

```json
{
  "schemaVersion": 1,
  "lastAppliedConfig": null,
  "metadata": {}
}
```

## timeline (`nodeType: "timeline"`)

タイムラインプラグインは PeerStore のみ定義されており、ドラフト生成ロジックは未整備。PeerStore の保存形式は次の通りで、実際の初期値は呼び出し側が指定する必要がある。

参照: `packages/plugins/timeline-plugin/src/worker/timelinePeerStore.dexie.ts`

PeerStore には `flamePerSecond` と `restartIntervalInMsec` の 2 つの数値が必須で、デフォルト値は実装されていない。新規作成時は呼び出し側で明示的に値を指定する必要がある（例として `0` を指定するのが一般的）。

## その他のプラグイン

- `linker-plugin` や `route-engine-registry` などの補助プラグインは PeerStore を持たず、Working Copy ドラフトを Worker で直接扱う実装はまだ存在しない。
- フォルダ以外の `TreeNode` 基本情報（`holderType`, `holderTargetId` など）は `packages/runtime/worker/src/services/WorkingCopyTreeNodeOperations.ts` の `createNewDraftWorkingCopy` で一括生成される。

## まとめ表

| nodeType | PeerStore デフォルト | ドラフト初期化の有無 |
|:---------|:---------------------|:---------------------|
| `folder` | `{ "schemaVersion": 1, "domain": {} }` | TreeNode 側のみ |
| `basemap` | `{ "schemaVersion": 1, "presentation": null, "metadata": {} }` | あり（`new BaseMap` テンプレート） |
| `location` | `{ "schemaVersion": 1, "lastProgress": null, "lastError": null, "metadata": {} }` | あり（地理情報のデフォルト） |
| `shape` | `{ "schemaVersion": 1, "lastProcessedTile": null, "metadata": {} }` | あり（Natural Earth プリセット） |
| `spreadsheet` | `{ "schemaVersion": 1, "lastViewedSheet": null, "metadata": {} }` | なし（UI で補完） |
| `route` | `{ "schemaVersion": 1, "lastComputedAt": null, "metadata": {} }` | なし（UI で補完） |
| `resolver` | `{ "schemaVersion": 1, "lastExecutedAt": null, "metadata": {} }` | 既存エンティティのコピーのみ |
| `styler` | `{ "schemaVersion": 1, "lastAppliedConfig": null, "metadata": {} }` | なし（UI で補完） |
| `timeline` | `{ "flamePerSecond": 0, "restartIntervalInMsec": 0 }` | なし（呼び出し側で指定） |

上記を基に、ツリーノード作成時に UI / Worker どちらで初期値を埋めるべきかを判断できる。新規プラグインを追加する際は同様の `normalizeFooPeerData`・`createNewDraftWorkingCopy` を用意し、PeerStore/Working Copy 双方でスキーマが欠けないようにすることが推奨される。

## ベースラインガイドライン

- **必須フィールド**: Working Copy は `treeNodeId` / `schemaVersion` / `createdAt` / `updatedAt` / `isDraft` を必ず保持する。Plugin 固有フィールドは draft ペイロードに集約し、トップレベルには UI/既存コード互換のコピーを残す。
- **ユーティリティ活用**: ドラフト生成は `createDraftWorkingCopyBase` を利用し、必要な更新は `markWorkingCopyUpdated` で反映する。PeerStore 正規化は `createPeerStoreNormalizer` を介して行う。
- **メソッド命名規約**: `createWorkingCopy` / `commitWorkingCopy` / `discardWorkingCopy` / `updateWorkingCopy` を提供し、Working Copy service から呼ばれることを前提にする。PeerStore は `create<Plugin>PeerStoreDexie` の形式で登録する。
- **PR チェックリスト**: プラグイン改修時は以下を確認する。
  1. Working Copy が `WorkingCopyBase` を `extends` しているか。
  2. Peer データが `PeerDataBase` を `extends` しており、`schemaVersion` の更新手順が記載されているか。
  3. ドラフト初期化ロジックが共通ヘルパーを利用しているか。
  4. 本ドキュメントの表に該当プラグインの既定値が追記/更新されているか。
