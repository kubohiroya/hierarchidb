# Folder Export Dialog (Export Menu from Folder Context)

## Goal

Provide a folder-level export flow accessible from the folder node context menu and produce
artifacts for the selected folder subtree via a guided multi-step dialog.

## Scope

This branch implements:

1. **Import/Export continuity mode**
   - Export a folder subtree and re-import it to another console as a reconstructed hierarchy.
2. **External distribution mode**
  - UI includes options for `pbf.zip` and `mvf`, and runtime emits vector-tile archives.

## Route design

- Context menu action for a folder is routed to:
  - `/t/:treeId/:pageNodeId/:targetNodeId/folder/export/:mode/:step`
- The host uses `loadNodeAction(...)` normally (no special archive-like branch).
- `:mode` is used as dialog display mode (kept as route compatibility).
- `:step` opens the wizard at the requested step index.
- `:pageNodeId` falls back to `${treeId}:root` when omitted.

## Step sequence (5 steps)

1. **Purpose**
   - `continuity` (default): app-side interoperability export.
   - `distribution`: external distribution target.
2. **Target Nodes**
   - `all`: include all descendants under the folder.
   - `shapeOnly`: include shape descendants only.
3. **Output Format**
  - `continuity` forces `json`.
  - `distribution` allows `pbf.zip` / `mvf` in UI and runtime generates tile archives in those formats.
4. **Options**
   - `continuity`: fixed values.
   - `distribution`: editable `minZoom`, `maxZoom`, `maxTileBytes`, `downloadPayload`.
5. **Review**
   - Summary and build trigger.

## Execution logic (current)

- Export is started from `Review` step capability (`canStartBuild`, `startBuild`).
- `startBuild` logic:
  - Resolve worker client via `__HDB_WORKER_CLIENT_REF__`.
  - Resolve Query API + ImportExport API.
  - Read the target node.
  - Collect IDs by scope:
    - `all`: target node + descendants via `includeChildren`.
    - `shapeOnly`: filter descendant nodeType `shape`.
  - Invoke `exportNodes(...)`.
  - Download resulting payload as browser blob and save to disk.
- `exportNodes` now collects `shape` vector tiles and emits `<nodeId>/<z>/<x>/<y>.pbf` entries plus
  `metadata.json` / `summary.json` in the archive.

## File naming / download

- Filename uses target folder label (safe-char sanitized) + ISO timestamp.
- Extension is derived from MIME type when present; otherwise falls back to selected format mapping.
- Export count is shown in success notification.

## Validation and error handling

- `continuity`: format fixed to JSON.
- `distribution`: validates option range when visible.
- Validation errors are shown in each step.
- Failures include: worker not ready, target not found, no exportable nodes, API failure, empty result.

## Import interoperability

- Exported JSON should be importable by folder-level import path and reconstruct hierarchy.
- This design keeps export/import as a separate round-trip concern from the browser-side distribution pipeline.

## Open items

- Add step-wise progress and large artifact handling for browser memory safety (streaming / chunked output).
