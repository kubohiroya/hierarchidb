# Spreadsheet Plugin (Next-Gen)

This package hosts the rebuilt Spreadsheet plugin that runs on the shared tabular ingestion stack.

- **Ingestion:** Files are parsed via `@hierarchidb/tabular-source` and persisted with `TabularWriter`/`SimpleTableMetadataManager`, so all row data lives inside the shared `RowStoreDB`.
- **UI:** Multi-step dialogs reuse `@hierarchidb/ui/tabular-extract` for file upload and filtering. The plugin exports the `DataSourceStep` and `FilteringStep` components so Styler (and other extensions) can embed the same UX.
- **API surface:** `SpreadsheetTabularApiDriver` implements `TabularDataApi` and is exposed through `createSpreadsheetCSVApi(pluginId)`. Consumers keep the same import paths as the legacy plugin but now benefit from shared storage.
- **Worker:** Only a peer store is registered (`createNodePayloadPeerStore`) because payload/draft now live directly on `TreeNode`.

See `plans/spreadsheet-plugin-rebuild.md` for the active ExecPlan.
