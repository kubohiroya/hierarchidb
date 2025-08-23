# BaseMap Plugin Documentation

Comprehensive documentation for HierarchiDB's BaseMap Plugin - a map layer management system providing basemap configuration and visualization capabilities.

## 📋 Documentation Overview

This directory contains all documentation related to the BaseMap Plugin, organized by topic and development phase.

### 📖 Core Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| **[overview.md](./overview.md)** | High-level plugin overview and architecture | All developers, PMs |
| **[data-model.md](./data-model.md)** | Database entities, entity handlers, and data flow | Backend developers |
| **[ui-architecture.md](./ui-architecture.md)** | React components and user interface | Frontend developers |
| **[implementation-guide.md](./implementation-guide.md)** | Development roadmap and implementation steps | All developers |

### 📚 Specialized Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| **[lifecycle.md](./lifecycle.md)** | Node lifecycle and plugin integration | Backend developers |
| **[api-reference.md](./api-reference.md)** | Complete API documentation | Integration developers |

## 🚀 Quick Start Guide

### For New Developers

1. **Start Here**: Read [overview.md](./overview.md) for plugin context
2. **Choose Your Path**:
   - **Backend Development**: [data-model.md](./data-model.md) → [implementation-guide.md](./implementation-guide.md)
   - **Frontend Development**: [ui-architecture.md](./ui-architecture.md) → [api-reference.md](./api-reference.md)
   - **Implementation**: [implementation-guide.md](./implementation-guide.md)

### For Project Managers

1. **Project Scope**: [overview.md](./overview.md) - Feature overview and benefits
2. **Development Plan**: [implementation-guide.md](./implementation-guide.md) - Implementation status and roadmap
3. **Technical Architecture**: [data-model.md](./data-model.md) - System design and entity architecture

## 🏗️ Plugin Architecture Summary

The BaseMap Plugin implements HierarchiDB's 4-layer architecture with specialized map management:

```
UI Layer (React/MUI) ←→ Comlink RPC ←→ Worker Layer ←→ IndexedDB Storage
                                           ↓
                                   BaseMapEntityHandler
                                           ↓
                              [BaseMapDB | WorkingCopy | TileCache]
```

### Key Components

- **Entity System**: PeerEntity pattern (1:1 relationship between TreeNode and BaseMapEntity)
- **Map Integration**: MapLibre GL JS style specification support
- **Stepper Dialog**: Multi-step configuration wizard for creating and editing maps
- **Tile Caching**: Ephemeral storage for map tile optimization
- **Working Copy**: Draft editing with commit/rollback capability

## 📊 Feature Highlights

### Map Styles
- **Predefined Styles**: Streets, Satellite, Hybrid, Terrain
- **Custom Styles**: Support for MapLibre GL Style specification
- **Style Configuration**: Complete style object or external URL support

### Map Controls
- **Viewport Management**: Center coordinates, zoom, bearing, pitch
- **Bounds Support**: Geographic boundary constraints
- **Display Options**: 3D buildings, traffic, transit, terrain, labels

### Data Management
- **Entity Storage**: Core database for persistent map configurations
- **Working Copy**: Ephemeral database for draft editing
- **Tile Cache**: Temporary storage for map tile optimization
- **API Integration**: External map service API key management

## 🔧 Implementation Status

### ✅ Completed
- Entity type definitions with MapLibre GL style support
- Entity handler with PeerEntityHandler pattern
- Multi-step stepper dialog UI framework
- Working copy pattern implementation
- Plugin configuration and registration
- Basic database schema and table definitions

### 🔄 In Progress
- Map preview component implementation
- Tile caching system
- Style validation and error handling
- API key management interface

### 📋 Planned
- Advanced map style editor
- Bulk map configuration import/export
- Map sharing and collaboration features
- Performance optimizations

## 📁 File Organization

```
docs/basemap/
├── README.md                    # This overview document
├── overview.md                  # Plugin overview and architecture
├── data-model.md               # Database entities and data flow
├── ui-architecture.md          # Frontend React components
├── implementation-guide.md      # Development roadmap and guidelines
├── lifecycle.md                # Node lifecycle and plugin integration
└── api-reference.md            # Complete API documentation
```

## 🎯 Documentation Goals

This documentation aims to:

1. **Provide Clear Architecture Overview** - Understand system design and component relationships
2. **Enable Efficient Development** - Step-by-step implementation guidance
3. **Ensure Code Quality** - Best practices and patterns
4. **Support Integration** - Complete API and interface documentation
5. **Facilitate Maintenance** - Comprehensive system understanding

## 🔗 Related Documentation

### HierarchiDB Core
- [Main Architecture Documentation](../02-architecture-overview.md)
- [Plugin System Guide](../04-plugin-entity-system.md)
- [Development Guidelines](../05-dev-guidelines.md)

### Implementation Files
- Plugin Source: `packages/plugins/basemap/`
- Plugin Configuration: `packages/plugins/basemap/plugin.config.ts`
- UI Components: `packages/plugins/basemap/src/components/`
- Entity Handler: `packages/plugins/basemap/src/handlers/`

## 🆘 Support and Contribution

### Getting Help
1. Check relevant documentation section first
2. Review [implementation-guide.md](./implementation-guide.md) for development questions
3. Consult [api-reference.md](./api-reference.md) for integration issues

### Contributing to Documentation
1. Follow existing document structure and style
2. Update this README when adding new documents
3. Maintain consistency with HierarchiDB core documentation
4. Include code examples and diagrams where helpful

---

**Last Updated**: August 2025  
**Documentation Version**: 1.0  
**Plugin Status**: Active Development