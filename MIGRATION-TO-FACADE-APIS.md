# Migration to Facade APIs

This document provides guidance for migrating from direct Worker API usage to the new facade API pattern.

## Overview

We have refactored the WorkerAPI implementation to use a facade pattern that provides better separation of concerns and cleaner API boundaries. All direct API methods are now deprecated and will be removed in v2.0.

## ✅ Migration Complete

The following refactoring has been completed:

### 1. Deprecated Direct APIs
All direct API methods in WorkerAPIImpl now have `@deprecated` JSDoc comments and delegate to facade APIs for backward compatibility:

```typescript
/**
 * @deprecated Use getQueryAPI().getNode() instead. Direct API access will be removed in v2.0.
 */
async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
  const queryAPI = this.getQueryAPI();
  return queryAPI.getNode(nodeId);
}
```

### 2. Added Facade API Implementations
WorkerAPIImpl now provides these facade API methods:
- `getQueryAPI()` - For read operations (getTree, getNode, listTrees, getChildren, etc.)
- `getMutationAPI()` - For write operations (createNode, updateNode, removeNodes, etc.)
- `getSubscriptionAPI()` - For real-time subscriptions
- `getWorkingCopyAPI()` - For working copy management
- `getPluginTreeAPI()` - For plugin-tree interactions
- `getNodeTypeAPI()` - For node type management
- `getPluginManagementAPI()` - For plugin management
- `getPluginRegistryAPI()` - Legacy API (deprecated)

### 3. Updated Worker Proxy
The app's worker proxy (`app/src/worker.ts`) now uses facade APIs internally:

```typescript
/**
 * @deprecated Use getQueryAPI().getTree() instead. Will be removed in v2.0.
 */
async getTree(params: { treeId: string }) {
  const instance = await this.getInstance();
  const queryAPI = await instance.getQueryAPI();
  return queryAPI.getTree(params.treeId as TreeId);
}
```

## 📋 Migration Guide for Developers

If you have any custom code using the Worker API, update it as follows:

### Old Pattern (Deprecated)
```typescript
const workerAPI = getWorkerAPIClient();

// Direct API calls (DEPRECATED)
const tree = await workerAPI.getTree({ treeId });
const node = await workerAPI.getNode(nodeId);
const children = await workerAPI.getChildren({ parentId });
const result = await workerAPI.create(params);
const nodes = await workerAPI.removeNodes(nodeIds);
```

### New Pattern (Recommended)
```typescript
const workerAPI = getWorkerAPIClient();

// Use facade APIs
const queryAPI = await workerAPI.getQueryAPI();
const mutationAPI = await workerAPI.getMutationAPI();

const tree = await queryAPI.getTree(treeId);
const node = await queryAPI.getNode(nodeId);
const children = await queryAPI.getChildren({ parentId });
const result = await mutationAPI.createNode(params);
const nodes = await mutationAPI.removeNodes(nodeIds);
```

### Plugin Development
```typescript
// Old way (DEPRECATED)
const pluginRegistryAPI = await workerAPI.getPluginRegistryAPI();

// New way (RECOMMENDED)
const pluginManagementAPI = await workerAPI.getPluginManagementAPI();
const nodeTypeAPI = await workerAPI.getNodeTypeAPI();
const pluginTreeAPI = await workerAPI.getPluginTreeAPI();
```

## 🔄 Backward Compatibility

- **Current State**: All direct API methods still work but are deprecated
- **Migration Period**: Update your code to use facade APIs
- **v2.0 Release**: Direct API methods will be removed

## ✨ Benefits of Facade APIs

1. **Better Separation of Concerns**: Each API handles a specific domain
2. **Easier Testing**: Mock individual APIs instead of the entire Worker
3. **Type Safety**: Stronger typing for each API boundary
4. **Future Extensibility**: Easy to add new APIs without bloating the main interface
5. **Performance**: Only load the APIs you need

## 🚀 Next Steps

1. **Review your codebase** for any direct Worker API usage
2. **Update to facade APIs** following the patterns above
3. **Test thoroughly** to ensure functionality remains the same
4. **Remove deprecated usage** before v2.0 release

## 📞 Support

If you encounter any issues during migration, please:
1. Check the console for deprecation warnings
2. Refer to the API documentation for each facade
3. Create an issue in the project repository

---

🎉 **Migration Complete!** All systems now use the facade pattern for better architecture and maintainability.