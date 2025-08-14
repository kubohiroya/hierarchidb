# BaseMap Plugin for HierarchiDB

Unified BaseMap plugin implementation for HierarchiDB, consolidating functionality from multiple existing implementations.

## Migration Status

This package consolidates and replaces the following existing implementations:

### Consolidated From:
- ✅ `packages/worker/src/plugin/examples/BaseMapPlugin.ts` - Entity handler and extended APIs
- ✅ `packages/ui-routing/src/plugins/BasemapViewComponent.tsx` - View component
- ✅ `packages/ui-routing/src/plugins/BasemapEditComponent.tsx` - Edit component

### Key Features Integrated:
- **From BaseMapPlugin.ts:**
  - Tile caching system (placeholder for future implementation)
  - Distance calculation (Haversine formula)
  - Bounds to center/zoom calculation
  - Map style management
  - Nearby maps search

- **From UI Components:**
  - View mode display
  - Edit mode with validation
  - Form controls for all map parameters

## Architecture

The plugin follows the UnifiedPluginDefinition architecture:

```typescript
BaseMapUnifiedDefinition
├── Entity Types (BaseMapEntity, BaseMapWorkingCopy)
├── EntityHandler (CRUD + extended operations)
├── Database (Dexie-based persistence)
├── Lifecycle Hooks (validation, cleanup)
├── UI Components (View, Edit, Dialog, Panel, Form, Icon)
├── Router Actions (view, edit, preview)
└── Metadata (version, dependencies, tags)
```

## Installation

```bash
# Add to your project
pnpm add @hierarchidb/plugin-basemap

# Install in worker
import { BaseMapUnifiedDefinition } from '@hierarchidb/plugin-basemap';
import { UnifiedNodeTypeRegistry } from '@hierarchidb/worker/registry';

const registry = UnifiedNodeTypeRegistry.getInstance();
registry.registerPlugin(BaseMapUnifiedDefinition);
```

## Usage

### Entity Operations

```typescript
import { BaseMapHandler } from '@hierarchidb/plugin-basemap';

const handler = new BaseMapHandler();

// Create a new basemap
const entity = await handler.createEntity(nodeId, {
  name: 'My Map',
  mapStyle: 'streets',
  center: [139.7670, 35.6814], // Tokyo
  zoom: 10
});

// Update map style
await handler.changeMapStyle(nodeId, 'satellite');

// Find nearby maps
const nearbyMaps = await handler.findNearbyMaps([139.7670, 35.6814], 50); // 50km radius
```

### UI Components

```typescript
import { BaseMapView, BaseMapEditor } from '@hierarchidb/plugin-basemap';

// View mode
<BaseMapView 
  nodeId={nodeId}
  entity={entity}
/>

// Edit mode
<BaseMapEditor
  entity={entity}
  onSave={handleSave}
  onCancel={handleCancel}
/>
```

## Entity Structure

### BaseMapEntity

| Field | Type | Description |
|-------|------|-------------|
| nodeId | TreeNodeId | Unique node identifier |
| name | string | Map name |
| description | string? | Optional description |
| mapStyle | enum | Style: streets, satellite, hybrid, terrain, custom |
| center | [number, number] | [longitude, latitude] |
| zoom | number | Zoom level (0-22) |
| bearing | number | Rotation angle (0-360°) |
| pitch | number | Tilt angle (0-60°) |
| bounds | object? | Optional map bounds |
| displayOptions | object? | Display configuration |

## Extended APIs

### Map Operations
- `changeMapStyle(nodeId, style)` - Change map style with cache clearing
- `setBounds(nodeId, bounds)` - Set bounds and calculate center/zoom
- `exportMapState(nodeId)` - Export complete map state
- `findNearbyMaps(center, radius)` - Find maps within radius

### Utility Functions
- `calculateDistance(point1, point2)` - Haversine distance calculation
- `calculateCenter(bounds)` - Calculate center from bounds
- `calculateZoom(bounds)` - Calculate appropriate zoom level

## Development

```bash
# Build the plugin
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## Migration Guide

### From BaseMapPlugin.ts

Replace:
```typescript
import { BaseMapEntityHandler } from '../plugin/examples/BaseMapPlugin';
```

With:
```typescript
import { BaseMapHandler } from '@hierarchidb/plugin-basemap';
```

### From UI Components

Replace:
```typescript
import BasemapViewComponent from '../ui-routing/src/plugins/BasemapViewComponent';
import BasemapEditComponent from '../ui-routing/src/plugins/BasemapEditComponent';
```

With:
```typescript
import { BaseMapView, BaseMapEditor } from '@hierarchidb/plugin-basemap';
```

## Future Enhancements

- [ ] Implement actual tile caching system
- [ ] Integrate MapLibre GL for map rendering
- [ ] Add support for custom style URLs
- [ ] Implement offline map support
- [ ] Add geospatial search capabilities
- [ ] Support for map overlays and layers

## License

MIT