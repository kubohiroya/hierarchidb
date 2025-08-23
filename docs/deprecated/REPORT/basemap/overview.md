# BaseMap Plugin Overview

The BaseMap Plugin provides comprehensive map layer management capabilities for HierarchiDB, enabling users to configure and manage basemap layers through an integrated configuration, storage, and visualization system.

## Architecture Overview

The BaseMap Plugin follows HierarchiDB's 4-layer architecture with strict UI-Worker separation:

```
UI Layer (React Components) ←→ Comlink RPC ←→ Worker Layer (Processing) ←→ IndexedDB (Storage)
```

### Key Components

- **UI Layer**: React components for map configuration, stepper dialogs, and visualization
- **Worker Layer**: Entity handlers for database operations and business logic
- **Data Layer**: IndexedDB storage with specialized tables for maps, working copies, and tile cache
- **API Layer**: PluginAPI integration for seamless HierarchiDB integration

## Feature Overview

### 1. Map Style Management
- **Predefined Styles**: Streets, Satellite, Hybrid, Terrain basemap options
- **Custom Styles**: Full MapLibre GL Style specification support
- **Style Configuration**: Complete style objects or external URL references
- **API Integration**: External map service API key management

### 2. Map Configuration
- **Viewport Settings**: Center coordinates, zoom level, bearing, and pitch control
- **Geographic Bounds**: Optional boundary constraints for map viewing area
- **Display Options**: Toggle features like 3D buildings, traffic, transit, terrain, and labels
- **Attribution Management**: Customizable map attribution and licensing information

### 3. Data Storage
Comprehensive entity system supporting:
- **BaseMap Entities**: Main map configuration data in core database
- **Working Copies**: Draft editing capabilities in ephemeral database
- **Tile Cache**: Optimized map tile storage for performance
- **Plugin Configuration**: Persistent plugin settings and preferences

## Documentation Structure

This documentation is organized into focused sections:

### Core Documentation
- **[overview.md](./overview.md)** - This overview document
- **[data-model.md](./data-model.md)** - Database entities, entity handlers, and data flow
- **[ui-architecture.md](./ui-architecture.md)** - React components and user interface
- **[implementation-guide.md](./implementation-guide.md)** - Development roadmap and implementation details

### Specialized Documentation
- **[lifecycle.md](./lifecycle.md)** - Node lifecycle and plugin integration
- **[api-reference.md](./api-reference.md)** - Complete API documentation

## Quick Start

### For Developers
1. **Backend Development**: Start with [data-model.md](./data-model.md) - Entity handler section
2. **Frontend Development**: Start with [ui-architecture.md](./ui-architecture.md)
3. **Data Modeling**: Review [data-model.md](./data-model.md) - Entity definitions section
4. **Implementation**: Follow [implementation-guide.md](./implementation-guide.md)

### For Users
1. **Creating BaseMap**: Use the BaseMap stepper dialog to configure map settings
2. **Editing Maps**: Modify existing map configurations through working copy pattern
3. **Viewing Maps**: Preview map configurations in the integrated map viewer

## Integration with HierarchiDB

The BaseMap Plugin seamlessly integrates with HierarchiDB's core systems:

- **Node Type System**: Registers as `'basemap'` node type
- **Entity Handlers**: Implements `BaseMapEntityHandler` for database operations
- **Working Copy Pattern**: Supports draft editing and commit/rollback
- **Command Pattern**: All mutations go through CommandManager
- **Subscription System**: UI automatically updates on data changes

## Entity Architecture

The BaseMap Plugin uses a **PeerEntity** pattern (1:1 relationship):

```
TreeNode (id: NodeId) ←→ BaseMapEntity (nodeId: NodeId)
```

### Database Tables

1. **Core Database** (Persistent)
   - `basemaps`: Main entity storage
   - Schema: `&nodeId, mapStyle, center, zoom, bearing, pitch, createdAt, updatedAt`

2. **Ephemeral Database** (Temporary)
   - `basemap_workingcopies`: Draft editing storage
   - `basemap_tiles_cache`: Map tile optimization cache

## Performance Characteristics

- **Entity Caching**: Working copy pattern for efficient draft editing
- **Tile Optimization**: Ephemeral cache for map tile storage
- **Style Validation**: Runtime validation of MapLibre GL style configurations
- **Lazy Loading**: Component lazy loading for optimal bundle size
- **Memory Management**: TTL-based cleanup for temporary data

## Technology Stack

### Frontend Components
- **React**: UI component framework
- **Material-UI (MUI)**: Component library and theming
- **MapLibre GL JS**: Map rendering and visualization
- **Stepper Component**: Multi-step configuration wizard

### Backend Integration
- **Dexie**: IndexedDB abstraction for data storage
- **Comlink**: Worker communication for RPC calls
- **Plugin System**: HierarchiDB plugin architecture integration

## Key Features

### Configuration Wizard
- **Step 1**: Basic Information (name, description)
- **Step 2**: Map Style (predefined or custom style selection)
- **Step 3**: View Settings (viewport configuration and display options)
- **Step 4**: Preview (map configuration preview and validation)

### Style Support
- **MapLibre GL Styles**: Full specification support
- **External Style URLs**: Remote style configuration
- **Predefined Presets**: Common basemap styles (OSM, satellite, etc.)
- **Custom Configurations**: Advanced style object editing

### Data Validation
- **Coordinate Validation**: Longitude (-180 to 180), Latitude (-90 to 90)
- **Zoom Validation**: Level constraints (0 to 22)
- **Bearing Validation**: Rotation angle (0 to 360 degrees)
- **Pitch Validation**: Tilt angle (0 to 60 degrees)
- **Style Validation**: MapLibre GL style specification compliance

## Next Steps

1. Review the specific architecture documentation for your area of interest
2. Follow the implementation guide for hands-on development
3. Refer to the API reference for detailed interface documentation
4. Explore the UI architecture for component integration patterns