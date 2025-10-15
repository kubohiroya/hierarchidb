# Plugin Migration Guide - Moving to 3-Layer Architecture

既存のプラグインを新しい3層アーキテクチャ（UI/Worker/Shared）に移行するためのガイドです。

## Migration Overview

### Before (Old Structure)
```
packages/plugins/project/
├── src/
│   ├── openstreetmap-type.ts                   # Mixed exports
│   ├── definitions/
│   │   └── ProjectDefinition.ts   # ❌ UI+Worker混在
│   ├── types/
│   ├── handlers/
│   │   ├── ProjectHandler.ts      # ❌ 冗長な中間層
│   │   └── ProjectEntityHandler.ts
│   └── components/                # ❌ UI専用なのにWorkerでも読み込み
└── package.json                   # Single export
```

### After (New 3-Layer Structure)
```
packages/plugins/project/
├── src/
│   ├── shared/                    # ✅ 共通定義
│   │   ├── metadata.ts
│   │   ├── lifecycle-plugin-definition.ts
│   │   └── constants.ts
│   ├── ui/                        # ✅ UI専用
│   │   ├── plugin.ts
│   │   ├── components/
│   │   ├── hooks/
│   │   └── validation/
│   └── worker/                    # ✅ Worker専用
│       ├── plugin.ts
│       ├── handlers/
│       ├── database/
│       └── validation/
└── package.json                   # Multi-entry exports
```

## Step 1: Create New Directory Structure

### 1.1 Create directories

```bash
cd packages/plugin-loader/your-plugin
mkdir -p src/{shared,ui,worker}
mkdir -p src/ui/{components,hooks,validation,lifecycle}
mkdir -p src/worker/{handlers,database,validation,lifecycle}
```

### 1.2 Update package.json

```json
{
  "name": "@hierarchidb/plugin-your-plugin",
  "exports": {
    ".": "./dist/index.ts",
    "./shared": "./dist/shared/index.ts",
    "./ui": "./dist/ui/index.ts", 
    "./worker": "./dist/worker/index.ts"
  },
  "sideEffects": false,
  "peerDependencies": {
    "react": "^18.0.0",
    "@hierarchidb/worker": "workspace:*"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "@hierarchidb/worker": { "optional": true }
  }
}
```

## Step 2: Migrate Shared Code

### 2.1 Extract Plugin Metadata

**Before:**
```typescript
// src/definitions/ProjectDefinition.ts - ❌ Problem: Mixed UI/Worker code
export const ProjectDefinition: EntityTypes<ProjectEntity> = {
  nodeType: 'project',
  name: 'Project',
  displayName: 'Map Project',
  icon: { name: 'map', emoji: '🗺️' },
  
  entityHandler: new ProjectEntityHandler(), // ❌ Worker instance in shared code
  
  lifecycle: {
    afterCreate: async (nodeId, entity) => { // ❌ Function not Comlink-serializable
      console.log(`Project created: ${entity.name}`);
    },
  },
  
  ui: {
    dialogComponent: ProjectDialog, // ❌ React component in shared code
  },
};
```

**After:**
```typescript
// src/shared/metadata.ts - ✅ Pure metadata, Comlink-serializable
import type { PluginMetadata } from '@hierarchidb/core';

export const ProjectMetadata: PluginMetadata = {
  nodeType: 'project',
  name: 'Project',
  displayName: 'Map Project',
  icon: { name: 'map', emoji: '🗺️', color: '#2196F3' },
  
  category: {
    treeId: '*',
    menuGroup: 'basic',
    createOrder: 2,
  },
  
  capabilities: {
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: true,
    supportsChildren: false,
    supportedOperations: ['create', 'read', 'update', 'delete'],
  },
  
  validation: {
    namePattern: '^[a-zA-Z0-9\\s\\-_]+$',
    maxChildren: 0,
  },
  
  ui: {
    dialogComponentPath: '@hierarchidb/plugin-project/components/ProjectDialog',
    panelComponentPath: '@hierarchidb/plugin-project/components/ProjectPanel',
    iconComponentPath: '@hierarchidb/plugin-project/components/ProjectIcon',
  },
  
  meta: {
    version: '1.0.0',
    author: 'HierarchiDB Team',
    description: 'Map composition and resource aggregation plugin',
    tags: ['map', 'project', 'composition'],
    experimental: false,
  },
};
```

### 2.2 Move Type Definitions

**Before:**
```typescript
// src/types/ProjectEntity.ts - Mixed location
export interface ProjectEntity {
  // ...
}
```

**After:**
```typescript
// src/shared/lifecycle-plugin-definition.ts - Centralized shared types
export interface ProjectEntity {
  id: EntityId;
  nodeId: NodeId;
  name: string;
  description?: string;
  // ... other fields
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  // ... other create fields
}

export interface UpdateProjectData extends Partial<CreateProjectData> {
  // Update-specific fields
}
```

### 2.3 Create Shared Index

```typescript
// src/shared/openstreetmap-type.ts
export { ProjectMetadata } from './metadata';
export * from './types';
export * from './constants';
export * from './utils';
```

## Step 3: Migrate UI Code

### 3.1 Extract UI Components

**Before:**
```typescript
// src/components/ProjectDialog.tsx - ❌ Mixed with Worker code
import { ProjectDefinition } from '../definitions/ProjectDefinition'; // Contains Worker code
```

**After:**
```typescript
// src/ui/components/ProjectDialog/ProjectDialog.tsx - ✅ UI-only imports
import type { CreateProjectData } from '../../../shared/types';
import { useProjectForm } from '../../hooks/useProjectForm';
```

### 3.2 Create UI Plugin Definition

```typescript
// src/ui/plugin.ts - ✅ UI-specific plugin definition
import type { UIPlugin } from '@hierarchidb/ui-client';
import { ProjectMetadata } from '../shared/metadata';
import { ProjectDialog } from './components/ProjectDialog';
import { ProjectPanel } from './components/ProjectPanel';
import { ProjectIcon } from './components/ProjectIcon';

export const ProjectUIPlugin: UIPlugin = {
  metadata: ProjectMetadata, // Shared metadata
  
  components: {
    DialogComponent: ProjectDialog,
    PanelComponent: ProjectPanel, 
    IconComponent: ProjectIcon,
  },
  
  validation: {
    validateForm: (data: CreateProjectData) => {
      const errors: ValidationError[] = [];
      
      if (!data.name?.trim()) {
        errors.push({ field: 'name', message: 'Name is required' });
      }
      
      return { isValid: errors.length === 0, errors };
    },
  },
  
  lifecycle: {
    beforeCreate: async (data: CreateProjectData) => {
      console.log('UI: Preparing to create project:', data.name);
    },
    
    afterCreate: async (entity: ProjectEntity) => {
      showSuccessNotification(`Project "${entity.name}" created successfully`);
    },
    
    beforeDelete: async (entity: ProjectEntity) => {
      const confirmed = await showConfirmDialog(`Delete project "${entity.name}"?`);
      if (!confirmed) throw new Error('Delete cancelled');
    },
  },
};
```

### 3.3 Create UI Index

```typescript
// src/ui/openstreetmap-type.ts
export { ProjectUIPlugin } from './plugin';
export * from './components';
export * from './hooks';
export * from './validation';
export * from './lifecycle';
```

## Step 4: Migrate Worker Code

### 4.1 Consolidate Entity Handler

**Before:**
```typescript
// src/handlers/ProjectHandler.ts - ❌ Redundant wrapper
export class ProjectHandler implements ProjectAPI {
  private entityHandler: ProjectEntityHandler;

  constructor(coreDB: any, ephemeralDB: any) {
    this.entityHandler = new ProjectEntityHandler(coreDB, ephemeralDB);
  }

  async createProject(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity> {
    return this.entityHandler.createEntity(nodeId, data as any); // ❌ Unnecessary delegation
  }
}

// src/handlers/ProjectEntityHandler.ts - ❌ No API implementation
export class ProjectEntityHandler {
  constructor(coreDB: any, ephemeralDB: any) { // ❌ External DB injection
    // ...
  }
}
```

**After:**
```typescript
// src/worker/handlers/ProjectEntityHandler.ts - ✅ Consolidated, implements API
import type { ProjectAPI } from '@hierarchidb/api';
import { ProjectMetadata } from '../../shared/metadata';
import type { ProjectEntity, CreateProjectData } from '../../shared/types';

export class ProjectEntityHandler implements ProjectAPI {
  private db: ProjectDatabase;

  constructor() { // ✅ Self-contained DB management
    this.db = ProjectDatabase.getInstance();
  }
  
  // ProjectAPI implementation
  async createProject(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity> {
    return this.createEntity(nodeId, data);
  }
  
  async getProject(nodeId: NodeId): Promise<ProjectEntity | undefined> {
    return this.getEntity(nodeId);
  }
  
  // EntityHandler implementation
  async createEntity(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity> {
    const entity: ProjectEntity = {
      id: generateEntityId(),
      nodeId,
      name: data.name,
      description: data.description || '',
      // ... other fields
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    await this.db.projects.add(entity);
    return entity;
  }
  
  // ... other methods
}
```

### 4.2 Create Worker Plugin Definition

```typescript
// src/worker/plugin.ts - ✅ Worker-specific plugin definition
import type { WorkerPlugin } from '@hierarchidb/worker';
import { ProjectMetadata } from '../shared/metadata';
import { ProjectEntityHandler } from './handlers/ProjectEntityHandler';

export const ProjectWorkerPlugin: WorkerPlugin<ProjectEntity> = {
  metadata: ProjectMetadata, // Same shared metadata
  
  entityHandler: new ProjectEntityHandler(),
  
  database: {
    tableName: 'projects',
    schema: '&id, nodeId, name, description, createdAt, updatedAt, version',
    version: 1,
  },
  
  validation: {
    validateEntity: async (entity: ProjectEntity) => {
      // Worker-side validation with DB access
      const existing = await checkProjectNameExists(entity.name, entity.nodeId);
      if (existing) {
        return {
          isValid: false,
          errors: [{ field: 'name', message: 'Project name already exists' }]
        };
      }
      return { isValid: true, errors: [] };
    },
  },
  
  lifecycle: {
    afterCreate: async (nodeId: NodeId, entity: ProjectEntity) => {
      console.log(`Worker: Project created - ${entity.name} (${nodeId})`);
      await initializeProjectResources(nodeId, entity);
    },
    
    beforeDelete: async (nodeId: NodeId, entity: ProjectEntity) => {
      console.log(`Worker: Cleaning up project - ${nodeId}`);
      await cleanupProjectResources(nodeId);
    },
  },
};
```

### 4.3 Create Worker Index

```typescript
// src/worker/openstreetmap-type.ts
export { ProjectWorkerPlugin } from './plugin';
export * from './handlers';
export * from './database';
export * from './validation';
export * from './lifecycle';
```

## Step 5: Update Build Configuration

### 5.1 Create tsup.config.ts

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig([
  // Main entry
  {
    entry: ['src/openstreetmap-type.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    treeshake: true,
  },
  // Shared entry
  {
    entry: ['src/shared/openstreetmap-type.ts'],
    outDir: 'dist/shared',
    format: ['esm'],
    dts: true,
    treeshake: true,
  },
  // UI entry
  {
    entry: ['src/ui/openstreetmap-type.ts'],
    outDir: 'dist/ui',
    format: ['esm'],
    dts: true,
    treeshake: true,
    external: ['provider', 'provider-dom', '@mui/material'],
  },
  // Worker entry
  {
    entry: ['src/worker/openstreetmap-type.ts'],
    outDir: 'dist/worker',
    format: ['esm'],
    dts: true,
    treeshake: true,
    external: ['@hierarchidb/worker', 'dexie'],
  },
]);
```

### 5.2 Create Main Index

```typescript
// src/openstreetmap-type.ts - Main entry point
export * from './shared';

// Export everything for tree-shaking
export * from './ui';
export * from './worker';

// Namespace exports for organized imports
export * as Shared from './shared';
export * as UI from './ui';
export * as Worker from './worker';
```

## Step 6: Fix Type Issues

### 6.1 Remove 'any' types

**Before:**
```typescript
// ❌ Using 'any' everywhere
export function createDefaultLayerConfiguration(resourceNodeId: string): any {
  return {
    layerId: `layer_${resourceNodeId}`,
    layerType: 'vector',
    // ...
  };
}

export function isValidLayerConfiguration(config: any): boolean {
  return Boolean(config && config.layerId);
}
```

**After:**
```typescript
// ✅ Proper type definitions
import type { LayerConfiguration } from './types';

export function createDefaultLayerConfiguration(resourceNodeId: string): LayerConfiguration {
  return {
    layerId: `layer_${resourceNodeId}`,
    layerType: 'vector',
    layerOrder: 0,
    isVisible: true,
    opacity: 1,
    styleConfig: {
      source: {
        type: 'vector',
        url: `mapbox://source/${resourceNodeId}`,
      },
      paint: {},
      layout: {},
    },
    interactionConfig: {
      clickable: true,
      hoverable: true,
    },
  };
}

export function isValidLayerConfiguration(config: unknown): config is LayerConfiguration {
  return Boolean(
    config &&
    typeof config === 'object' &&
    'layerId' in config &&
    'layerType' in config &&
    'styleConfig' in config
  );
}
```

### 6.2 Add proper MapLibre types

```typescript
// src/shared/lifecycle-plugin-definition.ts
export type MapLibrePaintProperty = string | number | boolean | (string | number)[];
export type MapLibreLayoutProperty = string | number | boolean | (string | number)[];
export type MapLibreFilterExpression = (string | number | boolean | MapLibreFilterExpression)[];

export interface StyleConfiguration {
  source: LayerSource;
  paint?: Record<string, MapLibrePaintProperty>;
  layout?: Record<string, MapLibreLayoutProperty>;
  filter?: MapLibreFilterExpression;
}
```

## Step 7: Update Import Statements

### 7.1 Update UI Code Imports

**Before:**
```typescript
// ❌ Mixed imports
import { ProjectDefinition } from '../definitions/ProjectDefinition';
import { ProjectEntityHandler } from '../handlers/ProjectEntityHandler';
```

**After:**
```typescript
// ✅ Layer-specific imports
import type { ProjectEntity, CreateProjectData } from '../../shared/types';
import { ProjectMetadata } from '../../shared/metadata';
import { useProjectForm } from '../hooks/useProjectForm';
```

### 7.2 Update Worker Code Imports

**Before:**
```typescript
// ❌ Mixed imports
import { ProjectHandler } from './ProjectHandler';
```

**After:**
```typescript
// ✅ Worker-specific imports
import type { ProjectEntity } from '../../shared/types';
import { ProjectDatabase } from '../database/ProjectDatabase';
```

## Step 8: Update Registration Code

### 8.1 UI Registration

**Before:**
```typescript
// ❌ Mixed registration
import { ProjectDefinition } from '@hierarchidb/plugin-project';
uiRegistry.register(ProjectDefinition); // Contains Worker code
```

**After:**
```typescript
// ✅ UI-specific registration
import { ProjectUIPlugin } from '@hierarchidb/plugin-project/ui';
const uiRegistry = UIPluginRegistry.getInstance();
uiRegistry.register(ProjectUIPlugin);
```

### 8.2 Worker Registration

**Before:**
```typescript
// ❌ Mixed registration
import { ProjectDefinition } from '@hierarchidb/plugin-project';
workerRegistry.register(ProjectDefinition); // Contains UI code
```

**After:**
```typescript
// ✅ Worker-specific registration
import { ProjectWorkerPlugin } from '@hierarchidb/plugin-project/worker';
const workerRegistry = WorkerPluginRegistry.getInstance();
workerRegistry.register(ProjectWorkerPlugin);
```

## Step 9: Remove Old Files

After migration is complete and tested:

```bash
# Remove old files
rm -rf src/definitions/
rm -rf src/handlers/ProjectHandler.ts  # Keep EntityHandler, rename to match new structure
rm -rf src/types/  # Moved to shared/
```

## Step 10: Update Tests

### 10.1 Separate UI and Worker Tests

**Before:**
```typescript
// ❌ Mixed tests
import { ProjectDefinition } from '../src/definitions/ProjectDefinition';
```

**After:**
```typescript
// ✅ UI-specific tests
// src/ui/__tests__/ProjectDialog.test.tsx
import { ProjectUIPlugin } from '../plugin';
import { ProjectDialog } from '../components/ProjectDialog';

// ✅ Worker-specific tests  
// src/worker/__tests__/ProjectEntityHandler.test.ts
import { ProjectWorkerPlugin } from '../plugin';
import { ProjectEntityHandler } from '../handlers/ProjectEntityHandler';
```

## Verification Checklist

- [ ] **Build succeeds**: `pnpm build` completes without errors
- [ ] **Type checking passes**: `pnpm typecheck` shows no errors
- [ ] **Proper exports**: Can import from `/shared`, `/ui`, `/worker` paths
- [ ] **UI-only imports**: UI code doesn't import Worker-specific modules
- [ ] **Worker-only imports**: Worker code doesn't import React/DOM APIs
- [ ] **Shared code is pure**: No React dependencies or side effects in shared/
- [ ] **TreeTypes-shaking works**: Bundle analysis shows proper code splitting
- [ ] **Tests pass**: All tests updated and passing
- [ ] **Registration works**: Plugins register and function correctly

## Common Migration Issues

### Issue 1: Circular Dependencies

**Problem:**
```typescript
// ❌ Circular dependency
// ui/plugin.ts imports shared/metadata.ts
// shared/metadata.ts imports ui/components/ProjectDialog
```

**Solution:**
```typescript
// ✅ Use component paths instead of direct imports
// shared/metadata.ts
ui: {
  dialogComponentPath: '@hierarchidb/plugin-project/components/ProjectDialog',
  // Don't import the actual component
}
```

### Issue 2: 'any' Type Cleanup

**Problem:**
```typescript
// ❌ 'any' types breaking inference
function handleData(data: any): any {
  return processData(data);
}
```

**Solution:**
```typescript
// ✅ Proper generic types
function handleData<T extends ProjectEntity>(data: T): ProcessedData<T> {
  return processData(data);
}
```

### Issue 3: Database Access in UI

**Problem:**
```typescript
// ❌ Direct database access in UI
const entity = await database.projects.get(nodeId);
```

**Solution:**
```typescript
// ✅ Use Worker API via Comlink
const workerAPI = await getWorkerAPI();
const entity = await workerAPI.project.getProject(nodeId);
```

This migration guide should help you successfully convert existing plugins to the new 3-layer architecture!