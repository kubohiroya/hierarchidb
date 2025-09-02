@hierarchidb/tabular
====================

Parse, profile, and ingest tabular data (CSV/TSV/JSONL and optional XLSX) as a reusable capability. Provides a Facade + Parser registry + StorePort abstraction so plugins can analyze/process rows and persist data in their own stores.

Design intent
-------------
- Separate “row-oriented parsing” from “where/how data is stored”.
- Keep the core light (text formats); move XLSX into an optional package.
- Enable plugin-specific processing via a future Processor registry (schema mapping, row transforms, validation).

Architecture
------------
- Facade: `TabularService`
  - `detect(input)` → format
  - `parse(input, opts)` → `AsyncIterable<TabularChunk>` + preview/schema
  - `ingest(input, storePort, opts)` → orchestrates parse→chunk→store
- Parsers: registered via `registerParser(parser)`
  - included: CSV (`,`), TSV (`\t`), JSONL
  - optional: XLSX is provided by `@hierarchidb/tabular-xlsx`
- StorePort: persistence abstraction
  - `beginIngest(schema, ctx)` → session
  - `writeChunk(session, chunk)`
  - `commit(session, summary)` → metadata
  - `abort(session)`

Quick start (ingest)
--------------------
```ts
import { TabularService, type FileLike } from '@hierarchidb/tabular';
import { MyStorePort } from './MyStorePort'; // implements TabularStorePort

const tab = new TabularService();
const res = await tab.ingest(file as FileLike, new MyStorePort(), { filename: file.name, chunkSize: 1000 });
console.log('metadata', res.metadata);
```

XLSX support
------------
- Install `@hierarchidb/tabular-xlsx` and call `installTabularXlsx()` at startup (runtime-worker does dynamic import if present).
- This keeps the core bundle small when Excel is not needed.

Usage notes
-----------
- `parse()` yields logical chunks to cap memory usage; choose `chunkSize` based on UI/DB throughput.
- Schema types are detected heuristically for text formats (basic); perform strict typing in your processor/store.
- `ingest()` delegates persistence to your StorePort; the package does not write to your DB.

Roadmap
-------
- Processor registry: `mapSchema/transformRow/validateRow` with per-plugin pipelines
- Streaming XLSX (when library support allows)
- Benchmarks and large-file guidance

