# Draft Handling Policy (TreeNodeUpdater)

- Keep TreeNode state split: `metadata`/`draftMetadata` for name/description/tags, `data`/`draftData` for plugin payload only.
- Treat new drafts as `version: 0` (set by `initTreeNode`); do not write `version` into `draftData`. Discard logic deletes uncommitted nodes when `version <= 0` and no committed data exists.
- When writing draft payloads, exclude runtime-only fields (timestamps, metadata) unless they are part of the persisted entity. If a field lives in `metadata`, do not duplicate it in `draftData`.
- Draft writes should go through `updateTreeNodeDraftData`/`updateTreeNodeDraftMetadata` (via `useTreeNodeUpdater` in UI) to keep payload and metadata separate.
- When converting drafts back to entities, preserve `version` from the draft if present; otherwise default to `0` to stay compatible with the shared discard rule.

Action items for plugins:
- Do not include `version` inside `draftData`.
- Use `draftMetadata` for basic info and `draftData` for plugin-specific payloads.
- Avoid storing timestamps or TreeNode metadata inside `draftData` unless they are part of the entity schema.
