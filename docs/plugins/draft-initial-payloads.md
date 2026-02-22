# TreeNode Payload / Working Copy Defaults

本ドキュメントは、各プラグインの `TreeNode.payload` とワーキングコピー (`TreeNode.draft`) がどのような初期状態で生成されるかを整理する。2025-11 以降、PeerEntity は Dexie `peerEntities` テーブルではなく `TreeNode<TPayload>` に直接保存されるようになり、PeerStore は廃止された。ここでは主に「payload 正規化の結果」と「ワーキングコピーや UI が用意する初期値」を JSON 風スニペットで記載する。

> 最終更新: 2025-11-19

## folder (`nodeType: "folder"`)

### Payload 正規化
参照: `plugins/folder-plugin/src/common/types/build-types.ts`

```json
{
  "schemaVersion": 1,
  "domain": {}
}
```

`normalizeFolderPeerData()` が空オブジェクトを許容し、TreeNode.payload には常に `schemaVersion` が入る。Folder は UI 表示系の値（name/description 等）を TreeNode 自身が持つため payload は極小のまま維持する。

### Working Copy
ワーキングコピーの生成（createDraft）は runtime-worker 側の共通ロジックが担い、Folder 固有の追加フィールドはない。基本情報フォームは UI 側の state で管理され、TreeNode.draft に name/description が書き戻されるのみである。

## basemap (`nodeType: "basemap"`)

### Payload 正規化
参照: `plugins/basemap-plugin/src/worker/factory/registerBasemapWorkerStores.ts` / `src/worker/utils/presentation.ts`

```json
{
  "schemaVersion": 1,
  "presentation": {
    "style": { "style": "streets" | "satellite" | "terrain" | "dark" | "light" | "custom" },
    "viewport": {
      "center": [<lng>, <lat>],
      "zoom": <number>,
      "bearing": <number>,
      "pitch": <number>
    }
  }
}
```

`normalizeBasemapPeerData()` は mapStyle / viewport を `presentation` にまとめ、TreeNode.payload と TreeNode.draft で同じ構造を共有する。UI が `presentation` を書き換えると、Worker 側の更新フローで normalize → CoreDB 更新が行われる。

### Viewport / Map Style 既定値
参照: `plugins/basemap-plugin/src/ui/components/steps/ViewportStep.tsx`

1. `LOCAL_STORAGE_KEY = 'zxy'` の JSON (`{ longitude, latitude, zoom }`) が存在すればそれを初期値に採用し、`TreeNode.draft.viewport` を設定する。
2. 保存済みデフォルトが無い場合は Geolocation API を要求し、許可されれば `accuracy` から算出した zoom と現在地を反映し `localStorage` にも書き込む。
3. Geolocation が拒否・失敗した場合は `[0, 0] / zoom 2` をフォールバックとして適用する。
4. MapLibreMap の view state 変更時には `persistViewportDefaults()` が `localStorage` を更新し、次回の create/edit ダイアログで即座に利用される。
5. Edit モードでは `useBaseMapEntity()` が TreeNode.payload から `viewport` を読み出し、Step3 が空の場合のみ初期化に使用する。

Map style の既定は `{ style: 'streets' }`。Basic Info ステップで name/description を編集すると `TreeNode.draft` に書き戻され、Save 時に TreeNode.payload へ commit される。

## location (`nodeType: "location"`)

### Payload 正規化
参照: `plugins/location-plugin/src/worker/normalizers.ts`

```json
{
  "schemaVersion": 1,
  "lastProgress": {
    "stage": "<string>",
    "completed": <number?>,
    "total": <number?>,
    "updatedAt": <timestamp?>
  },
  "lastError": {
    "message": "<string>",
    "code": "<string?>"
  },
  "metadata": { /* arbitrary */ }
}
```

`normalizePeerData()` は過去の dialogWindow/dialogProgress 互換も含めて TreeNode.payload に格納する。Group/Relation は引き続き Dexie テーブルを使用するため、payload にはロングランタスクの進捗と UI ステートのみを残す。

### Working Copy
`LocationEntityHandler`（`plugins/location-plugin/src/common/entities/LocationEntityHandler.ts`）が `DraftDraft` を合成し、カテゴリ・データソースなどの初期値を埋める。UI 側は StepCapabilities を参照して stepper 遷移可否を制御する。

## shape (`nodeType: "shape"`)

### Payload 正規化
参照: `plugins/shape-plugin/src/worker/factory/registerShapeWorkerStores.ts`

```json
{
  "schemaVersion": 1,
  "lastProcessedTile": "<tileId?>",
  "metadata": {}
}
```

Tile 進捗（`lastProcessedTile`）は UI の再開ポイントに利用される。Group/Relation は Dexie ストアに残り、payload にはジョブ状態のみを保存する。

## spreadsheet (`nodeType: "spreadsheet"`)

### Payload 正規化
参照: `plugins/spreadsheet-plugin/src/worker/factory/registerSpreadsheetWorkerStores.ts`

```json
{
  "schemaVersion": 1,
  "lastViewedSheet": null,
  "metadata": {}
}
```

UI で最後に表示したシート ID を payload に保持し、Edit 再開時のフォーカスに利用する。Table データそのものは Dexie group store で管理される。

## route (`nodeType: "route"`)

### Payload 正規化
参照: `plugins/route-plugin/src/worker/factory/registerRouteWorkerStores.ts`

```json
{
  "schemaVersion": 1,
  "lastComputedAt": null,
  "metadata": {}
}
```

Route のバッチ実行時刻のみ payload に保存し、UI の進捗表示や Resume 操作で利用する。

## resolver (`nodeType: "resolver"`)

### Payload 正規化
参照: `plugins/resolver-plugin/src/worker/factory/registerResolverWorkerStores.ts`

```json
{
  "schemaVersion": 1,
  "lastExecutedAt": null,
  "metadata": {}
}
```

Resolver は TreeNode.payload に最後の実行時刻を保持し、UI で「最終再解決」時刻を表示する。Group/Relation は引き続き Dexie ベース。

## styler (`nodeType: "styler"`)

### Payload 正規化
参照: `plugins/styler-plugin/src/worker/factory/registerStylerWorkerStores.ts`

```json
{
  "schemaVersion": 1,
  "lastAppliedConfig": {
    /* StylerConfig */
  },
  "metadata": {}
}
```

`normalizeStylerPeerData()` は最後に適用したスタイル設定（`StylerConfig`）と任意の metadata を TreeNode.payload に保持する。UI は payload を直接読んでフォームへ反映し、保存時は Worker 側の更新フローで CoreDB へ反映する。

---

今後プラグインを追加する際は、(1) normalize で `schemaVersion` を含めた payload を定義し、(2) UI/Worker の初期値がどこで決まるか（localStorage, geolocation, server defaults 等）を本ドキュメントへ追記すること。
