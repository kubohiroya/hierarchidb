# TreeToggleButtonGroup

Toggle button group for switching between multiple TreeConsole contexts with saved page ids.

## Directory layout
```
TreeToggleButtonGroup.tsx  Component
batch-types.ts                  TreeConfig helpers
index.ts                  Public exports
```

## Key features
- Multiple tree configs (id/label/icon/color/tooltip/routePath).
- Persists last visited page node per tree via provided get/save handlers.
- Optional `getNodeTreeId` validator to ensure node belongs to selected tree.
- Horizontal/vertical orientation; disabled states; tooltips.

## Usage (minimal)
```tsx
<TreeToggleButtonGroup
  trees={trees}
  selectedTreeId={selected}
  currentPageNodeId={currentNodeId}
  appPrefix="hierarchidb"
  getSavedPageNodeId={(treeId) => sessionStorage.getItem(`${treeId}PageNodeId`)}
  savePageNodeId={(treeId, nodeId) => sessionStorage.setItem(`${treeId}PageNodeId`, nodeId)}
  onTreeSelect={setSelected}
/>;
```

## Consumers
- TreeConsole navigation in app shell; used to switch resource/project/etc. consoles.
