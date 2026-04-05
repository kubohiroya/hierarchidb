# @hierarchidb/plugin-ui-sdk

Last updated: 2026-04-05

SDK package for HierarchiDB plugin UI development. Provides hooks and utilities needed for building plugin dialog step components.

## Key Features

- `useTreeNodeUpdater` — Hook for reading/writing TreeNode payload/draft (dirty detection, validation integration)
- `useSingleSourceDialogAtom` — Hook for managing dialog data with a jotai atom as single source
- `useDialogViewState` — Hook for managing dialog view state (loading, error, etc.)
- `createTreeNodeUpdaterActions` — Utility for generating TreeNode update actions
- `wrapDialogStepComponent` — Wrapper for dialog step components

## Public API

```typescript
import {
  useTreeNodeUpdater,
  useSingleSourceDialogAtom,
  useDialogViewState,
  createTreeNodeUpdaterActions,
  wrapDialogStepComponent,
} from '@hierarchidb/plugin-ui-sdk';
```

### useTreeNodeUpdater

```typescript
const { data, isDirty, updateField, save, reset } = useTreeNodeUpdater<MyDraft>({
  nodeId,
  nodeType: 'my-plugin',
});
```

### useSingleSourceDialogAtom

```typescript
const { value, setValue, isDirty } = useSingleSourceDialogAtom<MyDraft>({
  atom: myDraftAtom,
  initialValue: defaultDraft,
});
```

## Dependencies

| Package | Purpose |
| --- | --- |
| `@hierarchidb/core-types` | NodeId, NodeType |
| `@hierarchidb/tree-api` | TreeNode types |
| `@hierarchidb/worker-api` | Worker API |
| `@hierarchidb/ui-worker-provider` | Worker client |
| `@hierarchidb/ui-dialog` | Dialog base |
| `@hierarchidb/plugin-service-api` | Plugin service API |
| `jotai` | State management |

## Related Packages

- [`@hierarchidb/plugin-base`](../plugin-base/) — PluginStepRegistry (step registration target)
- [`@hierarchidb/plugin-ui-host`](../plugin-ui-host/) — Dialog host
- [`@hierarchidb/ui-dialog`](../ui/dialog/) — Dialog base

## License

MIT
