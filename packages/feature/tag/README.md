@hierarchidb/tag
=================

Tagging feature as a reusable capability. Centralizes tag CRUD and node–tag associations behind a small Facade + DB Port so any node-type can opt in without coupling to folder or worker internals.

Why
---
- Tags are cross-cutting, not folder-specific. Keeping them inside a node-type bloats responsibilities and blocks reuse.
- Facade + Port isolates persistence (Dexie/CoreDB now; server later) while giving UI/commands a stable API.

Architecture
------------
- Facade: `TagService` implements `TagAPI` (from `@hierarchidb/common-api`).
- Port: `TagDBPort` abstracts storage:
  - `createTag/getTag/updateTag/deleteTag/getAllTags`
  - associations: `createTagAssociation/getTagAssociation/remove*/get*ForNode/Tag`
- Capability: lightweight registry to declare which node types are taggable:
  - `registerTaggable(nodeType)`, `isTaggable(nodeType)`

Quick start
-----------
```ts
import { TagService } from '@hierarchidb/tag';
import { MyCoreDBPort } from './db/MyCoreDBPort'; // implements TagDBPort

const tag = await TagService.getSingleton(new MyCoreDBPort());
const t = await tag.createTag({ name: 'Important', color: '#f44336', category: 'user' });
await tag.addTagToNode({ nodeId, tagId: t.id });
```

Integration notes
-----------------
- runtime-worker uses a CoreDB adapter to wire `TagService` to IndexedDB via Dexie.
- UI should use capabilities to toggle chips/menus rather than hardcoding node-type checks.

Stability and scope
-------------------
- Public API conforms to `@hierarchidb/common-api/TagAPI` and is frozen (v0.1). Port allows swapping persistence without breaking callers.

Caveats
-------
- No server sync yet; conflict resolution is out of scope.
- Usage counts are best-effort; heavy batch ops may be eventually consistent.

Roadmap
-------
- Processor hooks for auto-tags (regex, rulesets)
- Batch tagging helper (`bulkAdd/bulkRemove` with progress)
- Optional remote store port

