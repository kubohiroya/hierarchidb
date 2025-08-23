# BaseMap Plugin Migration Guide

## Overview

The BaseMap plugin implementation has been consolidated from multiple locations into a single, unified package: `@hierarchidb/plugin-basemap`.

## Migration Status

### ✅ Completed
- Unified plugin architecture implementation
- Entity and handler consolidation
- UI component migration
- Backward compatibility via re-exports
- Deprecation notices added

### 🔄 Deprecated Files (with backward compatibility)
- `packages/worker/src/plugin/examples/BaseMapPlugin.ts`
- `packages/ui-routing/src/plugins/BasemapViewComponent.tsx`
- `packages/ui-routing/src/plugins/BasemapEditComponent.tsx`

### 📦 New Unified Package
- `packages/plugins/basemap/` - All BaseMap functionality

## Migration Steps

### 1. Update Imports

#### Worker/Handler Code
**Before:**
```typescript
import { BaseMapEntityHandler, basemapPlugin } from '@hierarchidb/worker/plugin/examples/BaseMapPlugin';
```

**After:**
```typescript
import { BaseMapHandler, BaseMapUnifiedDefinition } from '@hierarchidb/plugin-basemap';
```

#### UI Components
**Before:**
```typescript
import BasemapViewComponent from '@hierarchidb/ui-routing/plugins/BasemapViewComponent';
import BasemapEditComponent from '@hierarchidb/ui-routing/plugins/BasemapEditComponent';
```

**After:**
```typescript
import { BaseMapView, BaseMapEditor } from '@hierarchidb/plugin-basemap';
```

### 2. Update Plugin Registration

**Before:**
```typescript
// Old plugin registration
const handler = new BaseMapEntityHandler(coreDB, ephemeralDB);
pluginLoader.registerPlugin(basemapPlugin);
```

**After:**
```typescript
import { UnifiedNodeTypeRegistry } from '@hierarchidb/worker/registry';
import { BaseMapUnifiedDefinition } from '@hierarchidb/plugin-basemap';

const registry = UnifiedNodeTypeRegistry.getInstance();
registry.registerPlugin(BaseMapUnifiedDefinition);
```

### 3. Update Component Usage

**Before:**
```tsx
<BasemapViewComponent treeId={treeId} nodeId={nodeId} />
<BasemapEditComponent treeId={treeId} nodeId={nodeId} />
```

**After:**
```tsx
<BaseMapView treeId={treeId} nodeId={nodeId} entity={entity} />
<BaseMapEditor 
  nodeId={nodeId} 
  entity={entity}
  onSave={handleSave}
  onCancel={handleCancel}
/>
```

## Key Changes

### Architecture
- **Unified Plugin Definition**: Single source of truth for plugin configuration
- **Singleton Registry**: Centralized plugin management
- **Type Safety**: Full TypeScript support with strict typing
- **Lifecycle Hooks**: Comprehensive AOP-style lifecycle management

### Entity Structure
- `BaseMapEntity` now includes more comprehensive map configuration
- `BaseMapWorkingCopy` for edit operations
- MapLibre GL compatible style configuration

### Extended APIs
- Distance calculation (Haversine formula)
- Bounds to center/zoom calculation
- Nearby maps search
- Map style management with cache clearing

### UI Components
- Enhanced validation in edit mode
- Proper error handling and loading states
- Modular component architecture
- React 19+ compatible

## Breaking Changes

### Removed
- `TileCache` interface (moved to future implementation)
- Direct database table access (use handler methods)
- `PluginConfig` format (replaced with `UnifiedPluginDefinition`)

### Changed
- `BaseMapEntityHandler` → `BaseMapHandler`
- `basemapPlugin` → `BaseMapUnifiedDefinition`
- Component prop interfaces simplified

## Backward Compatibility

During the transition period, the old files have been replaced with deprecation stubs that:
1. Re-export from the new package
2. Log deprecation warnings in development
3. Maintain the same API surface

These deprecated files will be removed in the next major version.

## Testing

After migration, verify:
1. Plugin registration works correctly
2. Entity CRUD operations function
3. UI components render properly
4. No deprecation warnings in production builds
5. Type checking passes

## Timeline

- **Current**: Deprecated files with re-exports
- **Next Minor**: Deprecation warnings become more prominent
- **Next Major**: Deprecated files removed completely

## Support

For issues or questions about the migration:
1. Check the package README: `packages/plugins/basemap/README.md`
2. Review the unified plugin definition: `packages/plugins/basemap/src/definitions/BaseMapDefinition.ts`
3. See the test files for usage examples

## Benefits of Migration

1. **Single Source of Truth**: All BaseMap code in one package
2. **Better Maintainability**: No duplicate implementations
3. **Enhanced Features**: All best features from different implementations combined
4. **Type Safety**: Comprehensive TypeScript definitions
5. **Future Ready**: Prepared for MapLibre GL integration and tile caching