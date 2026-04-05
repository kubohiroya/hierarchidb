# @hierarchidb/chunk-store

Last updated: 2026-04-05

Chunk-based data store package for HierarchiDB. Provides a Dexie (IndexedDB) key-value chunk store (`DexieChunkStore`) and a Content-Addressable Store (CAS). Used for caching and persisting downloaded data.

## Key Features

- `DexieChunkStore<T>` — Dexie-based chunk store (get / put / delete / clear)
- `ContentAddressableStore` — Hash-based CAS (fetchToCas: download → hash → persist)
- `CacheAPICachePort` — Cache API adapter
- `DexieContentIndexPort` — Dexie-based content index
- `NobleSha3HashPort` — SHA-3 hash port

## Dependencies

`@hierarchidb/core-types`, `@hierarchidb/download`, `@hierarchidb/util`

## Related Packages

- [`@hierarchidb/tabular-store`](../tabular-store/) — Tabular data store (chunk-based row storage)
- [`@hierarchidb/download`](../download/) — Network download

## License

MIT
