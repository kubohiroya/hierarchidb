# Spreadsheet Plugin (Next-Gen)

This package hosts the rebuilt Spreadsheet plugin that runs on the shared tabular ingestion stack.

- **Ingestion:** Files are parsed via `@hierarchidb/tabular-source` and persisted with `TabularWriter`/`StylerMetadataManager`, so all row data lives inside the shared `RowStoreDB`.
- **UI:** Multi-step dialogs reuse `@hierarchidb/ui/tabular-extract` for file upload and filtering. The plugin exports the `TabularDataSourceStep` and `TabularDataFilterStep` components so Styler (and other extensions) can embed the same UX.
- **API surface:** `SpreadsheetTabularApiDriver` implements `TabularDataApi` and is exposed through `createSpreadsheetCSVApi(pluginId)`. Consumers keep the same import paths as the legacy plugin but now benefit from shared storage.
- **Worker:** PeerStore は廃止済みのため、Worker 側でのストア登録は行わない。

See `plans/spreadsheet-plugin-rebuild.md` for the active ExecPlan.

## Entity schema (2025-12-XX 現行)

`SpreadsheetEntity` (draftData/data) は以下のフィールドのみを正とします（SSOT）。

- `spreadsheetMetadataId?: string` — アップロード/ダウンロードで生成されたタブラーID
- `dataSource?: { type: 'file' | 'url'; source?: string; filename?: string; sizeBytes?: number; contentHash?: string }`
- `tabularTableMetadata?: TabularTableMetadata` — 取得済みタブラーのメタ情報
- `tabularProcessingConfig?: TabularProcessingConfig` — delimiter/encoding/hasHeader/quoteChar/escapeChar/skipEmptyLines
- `file?: { name: string; sizeBytes: number; type?: string; lastModifiedAt?: number }`
- `filters?: TabularFilterRule[]`
- `lastPreview?: TabularDataResult`

不要フィールド削除:
- `downloadUrl` / `importMethod` は廃止。URL・方式は `dataSource.type` と `dataSource.source` で一元管理。

## ダイアログステップ仕様（表示番号）

1. **Basic Info** (Tree metadata)
   - name/description/tags は TreeNode metadata に保存。`SpreadsheetEntity` には持たない。
2. **Data Source**
   - UI: `TabularFileUploadStep` (Local File/URL Download 切替 + Tabular Processing Options 5項目)
   - 永続化: `dataSource.type` で file/url を保持、URL は `dataSource.source` に保存。処理オプションは `tabularProcessingConfig` に保存。
   - 成功時に `spreadsheetMetadataId`, `tabularTableMetadata`, `file` を draftData にセット。
   - 初期表示は draftData の値（dataSource/tabularProcessingConfig）を優先的に再現。
3. **Filtering**
   - UI: `TabularFilterStep`
   - 永続化: `filters`, `lastPreview`。`spreadsheetMetadataId` を参照してメタデータをロード。
   - 状態分岐: metadataId 未設定→アップロードを促す/Loading/Error/取得成功で切替。

## ドラフト保持とステップ遷移
- ステップ遷移時は `updateLocalDraft` を呼び、`draftMetadata` / `draftData` を TreeNodeUpdater に保存するだけ。commit は行わない。
- commit/save を明示的に実行しない限り、`data` には書き込まれない。

## テンプレート反映
- `app/public/templates/population-2023/tree-nodes.json` の Spreadsheet ノードは上記スキーマに準拠し、URL は `draftData.dataSource.source` にのみ保持。`downloadUrl` は削除済み。
