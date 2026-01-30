@hierarchidb/tag
=================

Reusable tagging capability. Centralizes tag CRUD and node–tag associations behind a facade + DB port so any node type can opt in.

## Directory layout
```
TagService.ts   Facade implementing TagAPI
ports.ts        TagDBPort contract
capability.ts   register/isTaggable helpers
index.ts        Public exports + FeatureDefinition
```

## Key exports
- `TagService` — `create/get/update/delete` tags; `addTagToNode/removeTagFromNode/getTagsForNode/getNodesForTag`.
- Port: `TagDBPort` for persistence.
- Capability: `registerTaggable`, `isTaggable`.
- `FeatureDefinition.manifest` (`provides: ['tag']`).

## Consumers / usage
- Worker runtime wires `TagService` to CoreDB/Dexie; UI uses TagAPI from `@hierarchidb/tag-api`.
- Plugins toggle tag UI via `registerTaggable(nodeType)` instead of hardcoding.

## Notes / roadmap
- API frozen to TagAPI v0.1; no server sync yet.
- Future: auto-tag processors, batch helpers, optional remote store port.
