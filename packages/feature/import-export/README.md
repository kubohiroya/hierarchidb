@hierarchidb/import-export
==========================

Feature package for importing and exporting tree nodes. Provides a stable Facade + DB Port and simple capabilities so UIs and plugins can rely on a consistent API regardless of storage.

Scope
-----
- Import nodes from structured data (JSON, CSV, XML)
- Export subtree(s) to the same formats
- Progress callbacks, operation status, cancellation

Architecture
------------
- Facade: `ImportExportService` (`ImportExportAPI` compliant)
- Port: `ImportExportDBPort` (bulkCreateNodes/listChildren/getNode)
- Capability: helpers to enable/disable import/export per node-type or globally

Quick start
-----------
```ts
import { ImportExportService } from '@hierarchidb/import-export';
import { MyDBPort } from './db/MyDBPort';

const svc = await ImportExportService.getSingleton(new MyDBPort());
const result = await svc.importNodes({
  treeId, targetParentId, format: 'json', data: { nodes: [{ name: 'A' }, { name: 'B' }] },
  onProgress(p) { console.log(p.percentage); }
});
```

Integration notes
-----------------
- The runtime worker wires this facade to CoreDB via an adapter.
- All node-types are enabled for import/export by default at startup; use `disableImporter/Exporter` to opt out.

Stability
---------
- Public API follows `@hierarchidb/common-api/ImportExportAPI` (v0.1 frozen). DB Port shields callers from persistence changes.

Limitations
-----------
- CSV/XML formats are minimal and intended for basic interoperability.
- No conflict resolution beyond simple strategies (`skip/replace/rename`).

Roadmap
-------
- Streaming importers for large payloads
- Pluggable format handlers and validators
- Server-backed operations for multi-user scenarios

