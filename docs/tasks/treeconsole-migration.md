# TreeConsole Migration Plan

## Overview

This document provides a comprehensive step-by-step migration plan for extracting TreeConsole components from `references/eria-cartograph/app0` to a new `packages/ui-treeconsole` package within the HierarchiDB monorepo.

### Migration Scope

**Source:** `references/eria-cartograph/app0/src/`
- `components/console/`
- `features/tree-console/`  
- `features/tree-table/`
- Related shared components

**Target:** `packages/ui-treeconsole/`
- Following HierarchiDB architecture patterns
- Integrating with existing UI packages
- Maintaining separation of concerns

### Success Criteria

- [ ] All TreeConsole components migrated and functional
- [ ] Zero breaking changes to existing packages
- [ ] All tests passing
- [ ] Type safety maintained
- [ ] Documentation updated
- [ ] Performance benchmarks preserved

---

## Phase 1: Project Setup and Package Structure

**Duration:** 1-2 days

### 1.1 Create Package Structure

```bash
# Create the new package directory
mkdir -p packages/ui-treeconsole/{src,dist}
cd packages/ui-treeconsole
```

### 1.2 Initialize Package Configuration

Create `packages/ui-treeconsole/package.json`:

```json
{
  "name": "@hierarchidb/ui-treeconsole",
  "version": "1.0.0",
  "description": "TreeConsole components for HierarchiDB",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "development": "./src/index.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc && tsc-alias",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,scss}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,scss}\""
  },
  "dependencies": {
    "@hierarchidb/core": "workspace:*",
    "@hierarchidb/ui-core": "workspace:*",
    "@hierarchidb/ui-client": "workspace:*",
    "@hierarchidb/ui-theme": "workspace:*",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "^7.3.1",
    "@mui/material": "^7.3.1",
    "@tanstack/react-table": "^8.0.0",
    "@tanstack/react-virtual": "^3.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-dnd": "^16.0.0",
    "react-dnd-html5-backend": "^16.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.2",
    "vite": "^6.3.5",
    "vitest": "^2.1.8"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "license": "MIT"
}
```

### 1.3 Configure TypeScript

Create `packages/ui-treeconsole/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./src",
    "paths": {
      "~/*": ["./*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.*", "**/*.spec.*"]
}
```

### 1.4 Initialize Directory Structure

```bash
mkdir -p packages/ui-treeconsole/src/{
  components/{console,dialogs,ui},
  features/{tree-console,tree-table,tree-view-controller},
  contexts,
  hooks,
  types,
  utils
}
```

### 1.5 Create Initial Index File

Create `packages/ui-treeconsole/src/index.ts`:

```typescript
// Main console components
export { ResourcesConsole } from '~/components/console/ResourcesConsole';
export { ProjectsConsole } from '~/components/console/ProjectsConsole';
export { TreeConsole } from '~/components/console/TreeConsole';

// Core tree table components
export { TreeTableCore } from '~/features/tree-table/components/TreeTableCore';
export { TreeTableConsolePanel } from '~/features/tree-console/components/TreeTableConsolePanel';

// Contexts
export { TreeTableConsolePanelContext } from '~/features/tree-console/components/TreeTableConsolePanelContext';
export { DragDropConfigContext } from '~/features/tree-table/contexts/DragDropConfigContext';

// Hooks
export { useTreeViewController } from '~/features/tree-view-controller/hooks/useTreeViewController';

// Types
export * from '~/types';
```

### 1.6 Update Workspace Configuration

Add to `pnpm-workspace.yaml` (if not already included by `packages/*`):

```yaml
packages:
  - src
  - packages/*
  - packages/plugins/*
```

### 1.7 Update Monorepo Dependencies

Add to root `package.json` devDependencies (if needed):

```json
{
  "devDependencies": {
    "@hierarchidb/ui-treeconsole": "workspace:*"
  }
}
```

### 1.8 Verification Commands

```bash
# Install dependencies
pnpm install

# Verify package structure
pnpm --filter @hierarchidb/ui-treeconsole typecheck

# Verify workspace setup
pnpm list --depth=0 --filter @hierarchidb/ui-treeconsole
```

---

## Phase 2: Core Component Migration

**Duration:** 3-4 days

### 2.1 Migration Priority Order

Components will be migrated in dependency order (leaf components first):

1. **Type Definitions** → Base types and interfaces
2. **Utility Components** → Small, reusable pieces
3. **Context Providers** → State management
4. **Core Components** → Main functionality
5. **Entry Points** → Top-level console components

### 2.2 File-by-File Migration Checklist

#### 2.2.1 Types and Interfaces

**Source Files:**
- `references/eria-cartograph/app0/src/features/tree-console/types/index.ts`

**Target:** `packages/ui-treeconsole/src/types/index.ts`

**Migration Steps:**
```bash
# Copy types file
cp references/eria-cartograph/app0/src/features/tree-console/types/index.ts \
   packages/ui-treeconsole/src/types/index.ts
```

**Required Updates:**
```typescript
// Update imports to use workspace packages
// Before:
import { SomeType } from '../../../shared/types';

// After:
import { SomeType } from '@hierarchidb/core';
```

#### 2.2.2 Utility Components

**Files to migrate:**
- `InlineIcon.tsx` → `packages/ui-treeconsole/src/components/ui/InlineIcon/`
- `LinkButton.tsx` → `packages/ui-treeconsole/src/components/ui/LinkButton/`
- `SpeedDialMenu/*` → `packages/ui-treeconsole/src/components/ui/SpeedDialMenu/`
- `DebouncedInput.tsx` → `packages/ui-treeconsole/src/components/ui/DebouncedInput/`

**Migration Template:**
```bash
# For each utility component:
SOURCE_FILE="references/eria-cartograph/app0/src/path/to/Component.tsx"
TARGET_DIR="packages/ui-treeconsole/src/components/ui/ComponentName"
mkdir -p "$TARGET_DIR"
cp "$SOURCE_FILE" "$TARGET_DIR/index.tsx"

# Update imports in the new file
# Replace relative imports with workspace imports
# Update export structure
```

**Example Migration - InlineIcon:**
```typescript
// packages/ui-treeconsole/src/components/ui/InlineIcon/index.tsx
import React from 'react';
import { styled } from '@hierarchidb/ui-theme';

const StyledSpan = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  verticalAlign: 'middle',
  // ... existing styles
}));

export interface InlineIconProps {
  children: React.ReactNode;
  className?: string;
}

export const InlineIcon: React.FC<InlineIconProps> = ({ children, className }) => (
  <StyledSpan className={className}>
    {children}
  </StyledSpan>
);

export default InlineIcon;
```

#### 2.2.3 Dialog Components

**Files to migrate:**
- `FullScreenDialog.tsx` → `packages/ui-treeconsole/src/components/dialogs/FullScreenDialog/`

**Migration Steps:**
```bash
mkdir -p packages/ui-treeconsole/src/components/dialogs/FullScreenDialog
cp references/eria-cartograph/app0/src/shared/components/dialogs/FullScreenDialog.tsx \
   packages/ui-treeconsole/src/components/dialogs/FullScreenDialog/index.tsx
```

**Required Updates:**
```typescript
// Update MUI imports to use workspace theme
import { Dialog, DialogContent, Paper } from '@mui/material';
import { styled } from '@hierarchidb/ui-theme';

// Ensure drag event handling is preserved
// Update any custom theme usage to use workspace theme tokens
```

#### 2.2.4 Context Providers

**Files to migrate:**
- `DragDropConfigContext.tsx`
- `TreeTableConsolePanelContext.tsx`

**Target Structure:**
```
packages/ui-treeconsole/src/contexts/
├── DragDropConfigContext/
│   ├── index.tsx
│   └── types.ts
└── TreeTableConsolePanelContext/
    ├── index.tsx
    └── types.ts
```

**Migration Template:**
```typescript
// packages/ui-treeconsole/src/contexts/DragDropConfigContext/index.tsx
import React, { createContext, useContext, useMemo } from 'react';
import type { DragDropConfigContextValue } from './types';

const DragDropConfigContext = createContext<DragDropConfigContextValue | null>(null);

export const useDragDropConfig = () => {
  const context = useContext(DragDropConfigContext);
  if (!context) {
    throw new Error('useDragDropConfig must be used within DragDropConfigProvider');
  }
  return context;
};

export interface DragDropConfigProviderProps {
  children: React.ReactNode;
  value: DragDropConfigContextValue;
}

export const DragDropConfigProvider: React.FC<DragDropConfigProviderProps> = ({
  children,
  value
}) => (
  <DragDropConfigContext.Provider value={value}>
    {children}
  </DragDropConfigContext.Provider>
);

export * from './types';
```

### 2.3 Tree Table Core Components

**High Priority Files:**
- `TreeTableCore.tsx` (main table component)
- `TreeTableVirtualization.tsx` (virtualization logic)
- `TreeTableFlashPrevention.tsx` (WebKit optimization)
- `TreeTableRowCore.tsx` (row rendering)

**Migration Structure:**
```
packages/ui-treeconsole/src/features/tree-table/
├── components/
│   ├── TreeTableCore/
│   ├── TreeTableVirtualization/
│   ├── TreeTableFlashPrevention/
│   ├── rows/
│   ├── cells/
│   └── controls/
├── contexts/
├── hooks/
├── utils/
└── types/
```

**Key Considerations:**
- Preserve virtualization performance
- Maintain drag & drop functionality
- Keep accessibility features
- Update theme integration

### 2.4 Tree Console Components

**Files to migrate:**
- `TreeTableConsolePanel.tsx` (main panel)
- `TreeConsoleHeader.tsx`
- `TreeConsoleBreadcrumb.tsx`
- `TreeConsoleToolbar.tsx`
- `TreeConsoleContent.tsx`
- `TreeConsoleFooter.tsx`
- `TreeConsoleActions.tsx`

**Migration Priority:**
1. Error boundary components first
2. Layout components (header, footer)
3. Interactive components (toolbar, actions)
4. Main panel component last

### 2.5 Hook Migration

**Source:** `useTreeViewController.tsx`
**Target:** `packages/ui-treeconsole/src/hooks/useTreeViewController/`

**Special Considerations:**
- This is a complex hook with many dependencies
- May need to be split into smaller hooks
- Requires careful integration with existing UI client services

**Migration Approach:**
```typescript
// packages/ui-treeconsole/src/hooks/useTreeViewController/index.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkerServices } from '@hierarchidb/ui-client';
import type { TreeViewControllerOptions, TreeViewControllerReturn } from './types';

export const useTreeViewController = (
  options: TreeViewControllerOptions
): TreeViewControllerReturn => {
  const workerServices = useWorkerServices();
  
  // Migrate state management logic
  // Preserve CRUD operations
  // Maintain selection/expansion state
  // Keep search functionality
  
  return useMemo(() => ({
    // Return controller interface
  }), [/* dependencies */]);
};

export * from './types';
```

### 2.6 Entry Point Components

**Files to migrate (final step):**
- `ResourcesConsole.tsx`
- `ProjectsConsole.tsx` 
- `TreeConsole.tsx`

**Target:** `packages/ui-treeconsole/src/components/console/`

These are migrated last as they depend on all other components.

---

## Phase 3: Dependency Resolution and Integration

**Duration:** 2-3 days

### 3.1 Dependency Analysis

#### 3.1.1 Internal Dependencies (within package)
```bash
# Analyze internal imports in migrated files
grep -r "from ['\"]\.\./" packages/ui-treeconsole/src/ || echo "No relative imports found"

# Analyze import patterns
grep -r "from ['\"]~/" packages/ui-treeconsole/src/ | wc -l
```

#### 3.1.2 External Dependencies (cross-package)

**Required Dependencies:**
- `@hierarchidb/core` - Core types and interfaces
- `@hierarchidb/ui-core` - Base UI components  
- `@hierarchidb/ui-client` - Worker communication
- `@hierarchidb/ui-theme` - Theme and styling

**Dependency Verification:**
```bash
# Check if all required packages are available
pnpm --filter @hierarchidb/ui-treeconsole deps

# Verify import resolution
pnpm --filter @hierarchidb/ui-treeconsole typecheck
```

### 3.2 Import Path Standardization

#### 3.2.1 Internal Import Pattern
```typescript
// Use ~ prefix for package-internal imports
import { TreeConsoleHeader } from '~/features/tree-console/components/TreeConsoleHeader';
import { useDragDropConfig } from '~/contexts/DragDropConfigContext';
```

#### 3.2.2 External Import Pattern
```typescript
// Use workspace package imports
import { BaseComponent } from '@hierarchidb/ui-core';
import { useWorkerServices } from '@hierarchidb/ui-client';
import { TreeNode } from '@hierarchidb/core';
```

### 3.3 Theme Integration

#### 3.3.1 Styled Components Migration
```typescript
// Before (original code):
import { styled } from '@mui/material/styles';

// After (HierarchiDB pattern):
import { styled } from '@hierarchidb/ui-theme';
```

#### 3.3.2 Theme Token Usage
```typescript
// Update custom theme usage to use workspace theme
const StyledComponent = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  // Use theme tokens instead of hardcoded values
}));
```

### 3.4 Service Integration

#### 3.4.1 Worker Service Integration
```typescript
// Replace direct service imports with UI client hooks
// Before:
import { treeService } from '../../../services/treeService';

// After:
import { useWorkerServices } from '@hierarchidb/ui-client';

// In component:
const { treeService } = useWorkerServices();
```

### 3.5 Type Compatibility

#### 3.5.1 Core Type Alignment
```typescript
// Ensure TreeConsole types align with core types
import type { 
  TreeNode, 
  NodeTypeDefinition,
  TreeViewState 
} from '@hierarchidb/core';

// Update local types to extend core types where appropriate
export interface TreeConsoleNode extends TreeNode {
  // TreeConsole-specific properties
  isExpanded?: boolean;
  isSelected?: boolean;
}
```

---

## Phase 4: Interface Contracts and API Design

**Duration:** 2 days

### 4.1 Public API Definition

#### 4.1.1 Main Export Interface

Create `packages/ui-treeconsole/src/types/api.ts`:

```typescript
import type { ComponentType, ReactNode } from 'react';
import type { TreeNode } from '@hierarchidb/core';

// Main console component props
export interface TreeConsoleProps {
  /**
   * Root node IDs to display in the console
   */
  rootNodeIds: string[];
  
  /**
   * Initially expanded node IDs
   */
  expandedNodeIds?: string[];
  
  /**
   * Console mode configuration
   */
  mode: 'projects' | 'resources' | 'trash';
  
  /**
   * Optional custom header content
   */
  headerContent?: ReactNode;
  
  /**
   * Custom action components
   */
  customActions?: TreeConsoleActionDefinition[];
  
  /**
   * Event handlers
   */
  onNodeSelect?: (nodeIds: string[]) => void;
  onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  onNodeCreate?: (parentId: string, nodeType: string) => void;
  onNodeUpdate?: (nodeId: string, updates: Partial<TreeNode>) => void;
  onNodeDelete?: (nodeIds: string[]) => void;
}

// Action definition for extensibility
export interface TreeConsoleActionDefinition {
  id: string;
  label: string;
  icon: ComponentType;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  onClick: (selectedNodes: TreeNode[]) => void | Promise<void>;
  isVisible?: (selectedNodes: TreeNode[]) => boolean;
  isDisabled?: (selectedNodes: TreeNode[]) => boolean;
}

// Tree view controller configuration
export interface TreeViewControllerConfig {
  /**
   * Enable drag and drop
   */
  dragAndDrop?: boolean;
  
  /**
   * Enable multi-selection
   */
  multiSelect?: boolean;
  
  /**
   * Enable search functionality
   */
  searchEnabled?: boolean;
  
  /**
   * Virtual scrolling configuration
   */
  virtualization?: {
    enabled: boolean;
    itemHeight: number;
    overscan?: number;
  };
  
  /**
   * Undo/redo configuration
   */
  undoRedo?: {
    enabled: boolean;
    maxHistorySize?: number;
  };
}
```

#### 4.1.2 Context API Contracts

Update `packages/ui-treeconsole/src/contexts/TreeTableConsolePanelContext/types.ts`:

```typescript
import type { TreeNode } from '@hierarchidb/core';
import type { TreeViewControllerConfig } from '../types/api';

export interface TreeTableConsolePanelContextValue {
  // Current state
  selectedNodes: TreeNode[];
  expandedNodeIds: Set<string>;
  searchQuery: string;
  
  // Configuration
  config: TreeViewControllerConfig;
  
  // Actions
  selectNode: (nodeId: string, multiSelect?: boolean) => void;
  expandNode: (nodeId: string, expanded: boolean) => void;
  setSearchQuery: (query: string) => void;
  
  // CRUD operations
  createNode: (parentId: string, nodeType: string) => Promise<void>;
  updateNode: (nodeId: string, updates: Partial<TreeNode>) => Promise<void>;
  deleteNodes: (nodeIds: string[]) => Promise<void>;
  
  // Clipboard operations
  copyNodes: (nodeIds: string[]) => void;
  pasteNodes: (targetParentId: string) => Promise<void>;
  
  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}
```

### 4.2 Hook API Contracts

#### 4.2.1 useTreeViewController Contract

Create `packages/ui-treeconsole/src/hooks/useTreeViewController/types.ts`:

```typescript
export interface UseTreeViewControllerOptions {
  rootNodeIds: string[];
  config: TreeViewControllerConfig;
  onStateChange?: (state: TreeViewState) => void;
}

export interface UseTreeViewControllerReturn {
  // State
  state: TreeViewState;
  
  // Loading states
  isLoading: boolean;
  error: Error | null;
  
  // Node operations
  nodes: TreeNode[];
  selectedNodes: TreeNode[];
  
  // Actions
  actions: {
    selectNode: (nodeId: string, multiSelect?: boolean) => void;
    expandNode: (nodeId: string, expanded: boolean) => void;
    createNode: (parentId: string, nodeType: string) => Promise<void>;
    updateNode: (nodeId: string, updates: Partial<TreeNode>) => Promise<void>;
    deleteNodes: (nodeIds: string[]) => Promise<void>;
    moveNodes: (nodeIds: string[], targetParentId: string) => Promise<void>;
  };
  
  // Search
  search: {
    query: string;
    setQuery: (query: string) => void;
    results: TreeNode[];
    isSearching: boolean;
  };
  
  // Clipboard
  clipboard: {
    copy: (nodeIds: string[]) => void;
    paste: (targetParentId: string) => Promise<void>;
    canPaste: boolean;
  };
  
  // History
  history: {
    canUndo: boolean;
    canRedo: boolean;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
  };
}

export interface TreeViewState {
  expandedNodeIds: Set<string>;
  selectedNodeIds: Set<string>;
  searchQuery: string;
  viewMode: 'tree' | 'list';
}
```

### 4.3 Component API Standardization

#### 4.3.1 Consistent Props Pattern

```typescript
// Base props for all TreeConsole components
export interface BaseTreeConsoleComponentProps {
  className?: string;
  'data-testid'?: string;
}

// Props with theme integration
export interface ThemedTreeConsoleComponentProps extends BaseTreeConsoleComponentProps {
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
}
```

### 4.4 Event System Design

#### 4.4.1 Event Types

Create `packages/ui-treeconsole/src/types/events.ts`:

```typescript
import type { TreeNode } from '@hierarchidb/core';

export type TreeConsoleEventType = 
  | 'node:select'
  | 'node:expand'
  | 'node:create'
  | 'node:update'
  | 'node:delete'
  | 'node:move'
  | 'search:change'
  | 'view:change';

export interface TreeConsoleEvent<T = any> {
  type: TreeConsoleEventType;
  payload: T;
  timestamp: number;
}

// Specific event payload types
export interface NodeSelectEvent {
  nodeIds: string[];
  multiSelect: boolean;
}

export interface NodeExpandEvent {
  nodeId: string;
  expanded: boolean;
}

export interface NodeCreateEvent {
  parentId: string;
  nodeType: string;
  nodeData?: Partial<TreeNode>;
}

export interface NodeUpdateEvent {
  nodeId: string;
  updates: Partial<TreeNode>;
  previousValues: Partial<TreeNode>;
}

export interface NodeDeleteEvent {
  nodeIds: string[];
  nodes: TreeNode[]; // For potential undo
}

export interface NodeMoveEvent {
  nodeIds: string[];
  targetParentId: string;
  previousParentId: string;
}
```

---

## Phase 5: Testing and Validation

**Duration:** 2-3 days

### 5.1 Unit Testing Setup

#### 5.1.1 Test Configuration

Create `packages/ui-treeconsole/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'json-summary', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/'
      ]
    }
  },
  resolve: {
    alias: {
      '~': new URL('./src', import.meta.url).pathname
    }
  }
});
```

Create `packages/ui-treeconsole/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Mock Worker for tests
global.Worker = class Worker extends EventTarget {
  constructor() {
    super();
  }
  
  postMessage = vi.fn();
  terminate = vi.fn();
};

// Mock Comlink
vi.mock('comlink', () => ({
  wrap: vi.fn(),
  expose: vi.fn(),
  transfer: vi.fn(),
}));
```

#### 5.1.2 Test Utilities

Create `packages/ui-treeconsole/src/test/utils.tsx`:

```typescript
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@hierarchidb/ui-theme';
import { createTestTree, createTestNode } from './fixtures';

// Test wrapper with all required providers
const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

const customRender = (ui: React.ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Test data factories
export { createTestTree, createTestNode };
```

#### 5.1.3 Test Categories and Requirements

**Component Tests (Required Coverage: 90%+)**
- [ ] All UI components render without errors
- [ ] Props are passed correctly
- [ ] Event handlers work as expected
- [ ] Accessibility attributes are present
- [ ] Theme integration works

**Hook Tests (Required Coverage: 95%+)**
- [ ] `useTreeViewController` state management
- [ ] CRUD operations work correctly
- [ ] Search functionality
- [ ] Undo/redo operations
- [ ] Error handling

**Integration Tests**
- [ ] Full console workflow (create → edit → delete)
- [ ] Drag and drop operations
- [ ] Multi-selection behaviors
- [ ] Search and filter combinations

### 5.2 Testing Commands

```bash
# Run all tests
pnpm --filter @hierarchidb/ui-treeconsole test

# Run tests with coverage
pnpm --filter @hierarchidb/ui-treeconsole test --coverage

# Run tests in watch mode
pnpm --filter @hierarchidb/ui-treeconsole test --watch

# Run specific test file
pnpm --filter @hierarchidb/ui-treeconsole test TreeConsole.test.tsx
```

### 5.3 Integration Testing

#### 5.3.1 Cross-Package Integration

Create `packages/ui-treeconsole/src/test/integration/package-integration.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '../utils';
import { TreeConsole } from '~/components/console/TreeConsole';
import { createTestTree } from '../fixtures';

describe('Package Integration', () => {
  it('should integrate with ui-core components', () => {
    const testTree = createTestTree();
    
    render(
      <TreeConsole 
        rootNodeIds={[testTree.id]}
        mode="resources"
      />
    );
    
    expect(screen.getByTestId('tree-console')).toBeInTheDocument();
  });
  
  it('should integrate with ui-client services', async () => {
    // Test worker service integration
    // Test API communication
    // Test state synchronization
  });
  
  it('should integrate with ui-theme', () => {
    // Test theme tokens usage
    // Test styled components
    // Test responsive design
  });
});
```

### 5.4 Performance Testing

#### 5.4.1 Virtual Scrolling Performance

Create `packages/ui-treeconsole/src/test/performance/virtualization.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '../utils';
import { TreeTableCore } from '~/features/tree-table/components/TreeTableCore';
import { createLargeTestTree } from '../fixtures';

describe('Virtualization Performance', () => {
  it('should handle large trees efficiently', async () => {
    const largeTree = createLargeTestTree(10000); // 10k nodes
    
    const startTime = performance.now();
    
    render(
      <TreeTableCore 
        nodes={largeTree.nodes}
        virtualization={{ enabled: true, itemHeight: 32 }}
      />
    );
    
    const renderTime = performance.now() - startTime;
    
    // Should render large trees in reasonable time
    expect(renderTime).toBeLessThan(100); // 100ms threshold
  });
});
```

### 5.5 Accessibility Testing

#### 5.5.1 A11y Requirements

```typescript
// packages/ui-treeconsole/src/test/accessibility/tree-console.a11y.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { TreeConsole } from '~/components/console/TreeConsole';

expect.extend(toHaveNoViolations);

describe('TreeConsole Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(
      <TreeConsole 
        rootNodeIds={['test-root']}
        mode="resources"
      />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  
  it('should support keyboard navigation', () => {
    render(<TreeConsole rootNodeIds={['test']} mode="resources" />);
    
    // Test tab navigation
    // Test arrow key navigation
    // Test enter/space key actions
  });
});
```

---

## Phase 6: Documentation and Examples

**Duration:** 1-2 days

### 6.1 API Documentation

Create `packages/ui-treeconsole/README.md`:

```markdown
# @hierarchidb/ui-treeconsole

TreeConsole components for HierarchiDB - provides a complete tree management interface with virtualization, drag & drop, and full CRUD operations.

## Installation

```bash
pnpm add @hierarchidb/ui-treeconsole
```

## Quick Start

```tsx
import React from 'react';
import { TreeConsole } from '@hierarchidb/ui-treeconsole';

function App() {
  return (
    <TreeConsole
      rootNodeIds={['root-1', 'root-2']}
      mode="resources"
      onNodeSelect={(nodeIds) => console.log('Selected:', nodeIds)}
    />
  );
}
```

## Components

### TreeConsole

Main console component that provides a complete tree management interface.

**Props:**
- `rootNodeIds: string[]` - Root node IDs to display
- `mode: 'projects' | 'resources' | 'trash'` - Console mode
- `onNodeSelect?: (nodeIds: string[]) => void` - Selection handler

### TreeTableCore

Core tree table component with virtualization support.

**Props:**
- `nodes: TreeNode[]` - Tree nodes to display
- `virtualization?: VirtualizationConfig` - Virtual scrolling config

## Hooks

### useTreeViewController

Main hook for tree state management.

```tsx
const { state, actions, search } = useTreeViewController({
  rootNodeIds: ['root'],
  config: { dragAndDrop: true }
});
```

## Advanced Usage

### Custom Actions

```tsx
const customActions = [
  {
    id: 'export',
    label: 'Export',
    icon: ExportIcon,
    onClick: async (nodes) => {
      // Custom export logic
    }
  }
];

<TreeConsole
  rootNodeIds={rootIds}
  customActions={customActions}
  mode="resources"
/>
```

### Theme Customization

```tsx
import { ThemeProvider, createTheme } from '@hierarchidb/ui-theme';

const customTheme = createTheme({
  // Custom theme options
});

<ThemeProvider theme={customTheme}>
  <TreeConsole {...props} />
</ThemeProvider>
```

## Performance

- Virtual scrolling for large trees (>1000 nodes)
- Optimized rendering with React.memo
- Debounced search (300ms)
- Lazy loading support

## Accessibility

- Full keyboard navigation support
- ARIA attributes for screen readers
- High contrast mode support
- Focus management
```

### 6.2 Examples and Storybook

Create `packages/ui-treeconsole/.storybook/main.ts`:

```typescript
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-docs'
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
```

Create example stories in `packages/ui-treeconsole/src/components/console/TreeConsole.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { TreeConsole } from './TreeConsole';
import { createTestTree } from '../../test/fixtures';

const meta: Meta<typeof TreeConsole> = {
  title: 'TreeConsole/TreeConsole',
  component: TreeConsole,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ResourcesMode: Story = {
  args: {
    rootNodeIds: ['resource-root'],
    mode: 'resources',
  },
};

export const ProjectsMode: Story = {
  args: {
    rootNodeIds: ['project-root'],
    mode: 'projects',
  },
};

export const WithLargeTree: Story = {
  args: {
    rootNodeIds: ['large-tree-root'],
    mode: 'resources',
  },
};
```

---

## Phase 7: Build and Deployment

**Duration:** 1 day

### 7.1 Build Verification

```bash
# Clean build
pnpm --filter @hierarchidb/ui-treeconsole clean
pnpm --filter @hierarchidb/ui-treeconsole build

# Type checking
pnpm --filter @hierarchidb/ui-treeconsole typecheck

# Linting
pnpm --filter @hierarchidb/ui-treeconsole lint

# Testing
pnpm --filter @hierarchidb/ui-treeconsole test:run

# Build verification checklist
ls -la packages/ui-treeconsole/dist/
file packages/ui-treeconsole/dist/index.js
file packages/ui-treeconsole/dist/index.d.ts
```

### 7.2 Package Integration Testing

```bash
# Test package installation in consuming package
cd packages/app
pnpm add @hierarchidb/ui-treeconsole
pnpm typecheck

# Test import resolution
node -e "console.log(require('@hierarchidb/ui-treeconsole'))"
```

### 7.3 Monorepo Build Integration

Add to root `turbo.json`:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "@hierarchidb/ui-treeconsole#build": {
      "dependsOn": [
        "@hierarchidb/core#build",
        "@hierarchidb/ui-core#build",
        "@hierarchidb/ui-client#build",
        "@hierarchidb/ui-theme#build"
      ],
      "outputs": ["dist/**"]
    }
  }
}
```

### 7.4 CI/CD Integration

Update `.github/workflows/ci.yml` (if it exists):

```yaml
- name: Build packages
  run: |
    pnpm build
    pnpm --filter @hierarchidb/ui-treeconsole test:run
```

---

## Phase 8: Rollback Procedures

**Duration:** 0.5 days (preparation)

### 8.1 Pre-Migration Backup

```bash
# Create backup branch before starting migration
git checkout main
git pull origin main
git checkout -b backup/pre-treeconsole-migration
git push origin backup/pre-treeconsole-migration

# Create archive of reference files
tar -czf references-backup.tar.gz references/eria-cartograph/app0/src/
```

### 8.2 Rollback Plan

#### 8.2.1 Package Removal

```bash
# Remove the package from workspace
rm -rf packages/ui-treeconsole

# Remove from any consuming packages
find packages -name "package.json" -exec grep -l "@hierarchidb/ui-treeconsole" {} \;
# Remove dependencies from found packages

# Clean and rebuild
pnpm install
pnpm build
```

#### 8.2.2 Dependency Cleanup

```bash
# Remove from root dependencies
npm pkg delete devDependencies.@hierarchidb/ui-treeconsole

# Clean lock files
rm pnpm-lock.yaml
pnpm install
```

#### 8.2.3 Git Rollback

```bash
# Reset to backup branch
git checkout main
git reset --hard backup/pre-treeconsole-migration
git push origin main --force-with-lease

# Or revert specific commits
git log --oneline | grep treeconsole
git revert <commit-hash>
```

### 8.3 Rollback Verification

```bash
# Verify system works after rollback
pnpm install
pnpm typecheck
pnpm test:run
pnpm build

# Verify all packages still work
pnpm --filter @hierarchidb/app dev
```

---

## Timeline and Resource Estimates

### Overall Timeline: 12-15 days

| Phase | Duration | Prerequisites | Deliverables |
|-------|----------|---------------|-------------|
| **Phase 1: Setup** | 1-2 days | - | Package structure, configs |
| **Phase 2: Migration** | 3-4 days | Phase 1 | All components migrated |
| **Phase 3: Dependencies** | 2-3 days | Phase 2 | Integration complete |
| **Phase 4: API Design** | 2 days | Phase 3 | Public APIs defined |
| **Phase 5: Testing** | 2-3 days | Phase 4 | All tests passing |
| **Phase 6: Documentation** | 1-2 days | Phase 5 | Docs and examples |
| **Phase 7: Deployment** | 1 day | Phase 6 | Production ready |
| **Phase 8: Rollback Prep** | 0.5 days | - | Safety procedures |

### Resource Requirements

**Developer Skills Required:**
- Advanced TypeScript/React experience
- Familiarity with monorepo patterns (pnpm/turborepo)
- Experience with component library development
- Testing expertise (unit, integration, a11y)

**Infrastructure:**
- Node.js 18+ development environment
- Git with branch management capabilities
- Access to CI/CD pipeline configuration

### Risk Mitigation

**High-Risk Areas:**
1. Worker/UI communication abstraction
2. Complex drag-and-drop functionality
3. Virtual scrolling performance
4. Cross-package type compatibility

**Mitigation Strategies:**
- Incremental migration with continuous testing
- Parallel development branches
- Feature flags for gradual rollout
- Performance benchmarking at each phase

---

## Common Pitfalls and Prevention Strategies

### 9.1 Common Migration Pitfalls

#### 9.1.1 Circular Dependencies

**Problem:** Creating circular dependencies between packages, especially between ui-treeconsole and other UI packages.

**Signs:**
- Build failures with "Cannot find module" errors
- TypeScript errors about missing types during compilation
- pnpm/turborepo unable to determine build order

**Prevention:**
```typescript
// ❌ WRONG: ui-treeconsole importing from app
import { AppSpecificComponent } from '@hierarchidb/app';

// ✅ CORRECT: Define interfaces, let app implement
export interface TreeConsoleExtension {
  renderCustomAction?: (node: TreeNode) => ReactNode;
}
```

**Solution:**
- Use dependency injection patterns
- Define interfaces in ui-treeconsole, implementations in consuming packages
- Ensure clear dependency hierarchy: core → api → ui-* → app

#### 9.1.2 Worker Service Coupling

**Problem:** Direct coupling to Worker services, breaking the UI/Worker separation.

**Signs:**
- Direct Dexie/IndexedDB imports in UI components
- Worker-specific types leaking into UI layer
- Components that won't render without Worker context

**Prevention:**
```typescript
// ❌ WRONG: Direct Worker dependency
import { DataManagementWorkerService } from '@/workers/DataManagementWorkerService';
const service = DataManagementWorkerService.getInstance();

// ✅ CORRECT: Abstract through ui-client
import { useWorkerService } from '@hierarchidb/ui-client';
const service = useWorkerService('dataManagement');
```

**Solution:**
- Abstract all Worker communication through ui-client package
- Use dependency injection for services
- Mock services for testing and Storybook

#### 9.1.3 Type Definition Fragmentation

**Problem:** Duplicating or fragmenting type definitions across packages.

**Signs:**
- Same types defined in multiple packages
- Type mismatches at package boundaries
- "Type 'X' is not assignable to type 'X'" errors

**Prevention:**
```typescript
// ❌ WRONG: Redefining core types
// In ui-treeconsole
export interface TreeNode {
  id: string;
  name: string;
  // ...
}

// ✅ CORRECT: Import from core
import type { TreeNode } from '@hierarchidb/core';
```

**Solution:**
- All base types in @hierarchidb/core
- UI-specific types in respective UI packages
- Use type-only imports to avoid runtime dependencies

#### 9.1.4 State Management Chaos

**Problem:** Inconsistent state management between local component state, contexts, and Worker state.

**Signs:**
- State synchronization issues
- Race conditions in updates
- Lost updates or stale data

**Prevention:**
```typescript
// ❌ WRONG: Multiple sources of truth
const [nodes, setNodes] = useState([]);
const { nodes: contextNodes } = useContext(TreeContext);
const workerNodes = await service.getNodes();

// ✅ CORRECT: Single source of truth with clear data flow
const { nodes, updateNodes } = useTreeViewController({
  source: 'worker', // Clear data source
  syncStrategy: 'optimistic' // Clear update strategy
});
```

**Solution:**
- Define clear data flow: Worker → Hook → Component
- Use optimistic updates with rollback
- Implement proper error boundaries

### 9.2 Performance Pitfalls

#### 9.2.1 Bundle Size Explosion

**Problem:** Package becomes too large, affecting initial load time.

**Signs:**
- Bundle size > 500KB for the package alone
- Slow initial render
- Large dependency tree

**Prevention:**
```typescript
// ❌ WRONG: Importing entire libraries
import * as MUI from '@mui/material';
import _ from 'lodash';

// ✅ CORRECT: Specific imports and tree-shaking
import { Box, Button } from '@mui/material';
import debounce from 'lodash/debounce';
```

**Solution:**
- Use dynamic imports for heavy components
- Implement code splitting
- Regular bundle analysis

#### 9.2.2 Re-render Storms

**Problem:** Excessive re-renders causing performance degradation.

**Signs:**
- Laggy UI interactions
- High CPU usage during interactions
- React DevTools showing frequent re-renders

**Prevention:**
```typescript
// ❌ WRONG: Creating new objects in render
<TreeNode 
  config={{ expanded: true, selected: false }}
  onSelect={() => handleSelect(node.id)}
/>

// ✅ CORRECT: Memoization and stable references
const config = useMemo(() => ({ 
  expanded: true, 
  selected: false 
}), []);
const handleNodeSelect = useCallback((id) => {
  handleSelect(id);
}, [handleSelect]);
```

**Solution:**
- Proper memoization with React.memo, useMemo, useCallback
- Virtual scrolling for large lists
- Optimize context providers to minimize consumers

### 9.3 Testing Pitfalls

#### 9.3.1 Untestable Components

**Problem:** Components too tightly coupled to external dependencies.

**Signs:**
- Tests require complex mocking
- Tests break with unrelated changes
- Low test coverage despite effort

**Prevention:**
```typescript
// ❌ WRONG: Hard dependencies
export function TreeConsole() {
  const service = DataManagementWorkerService.getInstance();
  const auth = getAuthFromWindow();
  // ...
}

// ✅ CORRECT: Dependency injection
export function TreeConsole({ 
  service = useWorkerService(),
  auth = useAuth() 
}: TreeConsoleProps) {
  // ...
}
```

**Solution:**
- Dependency injection for all external services
- Props for overriding hooks in tests
- Separate presentation from business logic

#### 9.3.2 Flaky E2E Tests

**Problem:** E2E tests that intermittently fail.

**Signs:**
- Tests pass locally but fail in CI
- Random timeout errors
- "Element not found" errors

**Prevention:**
```typescript
// ❌ WRONG: Fixed timeouts
await page.waitForTimeout(1000);
await page.click('.tree-node');

// ✅ CORRECT: Explicit waits
await page.waitForSelector('.tree-node', { state: 'visible' });
await page.click('.tree-node');
await expect(page.locator('.tree-node')).toHaveAttribute('aria-expanded', 'true');
```

**Solution:**
- Use explicit wait conditions
- Add data-testid attributes
- Implement retry strategies

### 9.4 Maintenance Pitfalls

#### 9.4.1 Documentation Drift

**Problem:** Documentation becomes outdated as code evolves.

**Signs:**
- README examples don't work
- API documentation doesn't match implementation
- Storybook stories are broken

**Prevention:**
```typescript
// ✅ Use JSDoc with examples that are tested
/**
 * @example
 * ```tsx
 * <TreeConsole
 *   rootNodeId="resources"
 *   onNodeSelect={(node) => console.log(node)}
 * />
 * ```
 */
```

**Solution:**
- Documentation as code (MDX)
- Automated documentation generation
- Include docs in PR reviews

#### 9.4.2 Version Mismatch Issues

**Problem:** Package versions get out of sync in monorepo.

**Signs:**
- "Module not found" errors after updates
- Type mismatches between packages
- Build failures in CI but not locally

**Prevention:**
```json
// Use workspace protocol for internal dependencies
{
  "dependencies": {
    "@hierarchidb/core": "workspace:*",
    "@hierarchidb/ui-core": "workspace:*"
  }
}
```

**Solution:**
- Use pnpm workspace protocol
- Automated version bumping
- Lock file validation in CI

### 9.5 Integration Pitfalls

#### 9.5.1 Breaking Existing Functionality

**Problem:** Migration inadvertently breaks existing features.

**Signs:**
- Regression reports after deployment
- Existing tests start failing
- User complaints about missing features

**Prevention:**
- Create comprehensive test suite BEFORE migration
- Use feature flags for gradual rollout
- Maintain backward compatibility during transition

**Solution:**
```typescript
// Support both old and new APIs during transition
export { TreeConsole } from './new/TreeConsole';
export { TreeConsole as LegacyTreeConsole } from './legacy/TreeConsole';
```

#### 9.5.2 Theme and Styling Conflicts

**Problem:** Style conflicts between packages.

**Signs:**
- Inconsistent appearance
- CSS specificity battles
- Theme not applying correctly

**Prevention:**
```typescript
// ✅ Use theme tokens, not hard-coded values
const StyledContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2), // Not: padding: '16px'
  color: theme.palette.text.primary, // Not: color: '#000'
}));
```

**Solution:**
- Consistent use of theme provider
- CSS modules or styled-components isolation
- Theme token standardization

### 9.6 Prevention Checklist

Before starting each phase, verify:

- [ ] **Dependencies are clearly mapped** - No circular dependencies possible
- [ ] **Types are centralized** - All shared types in @hierarchidb/core
- [ ] **Abstractions are in place** - No direct Worker access from UI
- [ ] **Tests are prepared** - Test harness ready before migration
- [ ] **Performance benchmarks established** - Baseline metrics recorded
- [ ] **Documentation templates ready** - Consistent documentation format
- [ ] **Rollback plan tested** - Verify rollback procedure works
- [ ] **Feature flags configured** - Gradual rollout capability
- [ ] **Monitoring in place** - Error tracking and performance monitoring
- [ ] **Team alignment** - All stakeholders aware of changes

### 9.7 Success Indicators

Migration is successful when:

1. **Zero regression** - All existing features still work
2. **Performance maintained** - No degradation in metrics
3. **Clean architecture** - Clear separation of concerns
4. **Testable code** - >90% test coverage achieved
5. **Developer experience** - Easy to use and extend
6. **Documentation complete** - All APIs documented with examples
7. **Type safety** - No `any` types or `@ts-ignore`
8. **Bundle size optimized** - Under 500KB for the package
9. **No tech debt** - No "TODO: fix later" comments
10. **Reusable** - Successfully used by multiple consumers

---

## Summary

This migration plan provides a systematic approach to extracting TreeConsole components into a standalone package. By following these phases and paying attention to the common pitfalls, the migration can be completed successfully while maintaining code quality and system stability.

Key success factors:
- **Incremental approach** - Migrate gradually, test continuously
- **Clear boundaries** - Maintain separation between packages
- **Type safety** - Preserve TypeScript benefits throughout
- **Performance focus** - Monitor and optimize at each step
- **Documentation** - Keep docs in sync with implementation
- **Testing** - Comprehensive test coverage before and after
- **Rollback capability** - Be able to revert if issues arise

The total timeline of 12-15 days assumes a single developer working full-time. With proper planning and adherence to these guidelines, the TreeConsole package will become a valuable, reusable component in the HierarchiDB ecosystem

**High Risk Items:**
1. **useTreeViewController complexity** - Plan for potential hook decomposition
2. **Drag & drop functionality** - Extensive testing required
3. **Virtual scrolling performance** - Benchmark against original
4. **Theme integration** - Verify all custom styles work

**Mitigation Strategies:**
- Progressive migration (component by component)
- Automated testing at each phase
- Performance monitoring
- Regular integration testing
- Clear rollback procedures

---

## Validation Checklist

### Pre-Migration Validation
- [ ] Reference source code is accessible
- [ ] All target dependencies exist in workspace
- [ ] Build pipeline is working
- [ ] Test framework is configured

### During Migration Validation
- [ ] Each migrated component passes type checking
- [ ] No circular dependencies introduced
- [ ] Tests pass for each migrated component
- [ ] Performance benchmarks maintained

### Post-Migration Validation
- [ ] Full build pipeline passes
- [ ] All tests pass (unit + integration)
- [ ] No accessibility regressions
- [ ] Performance meets or exceeds baseline
- [ ] Documentation is complete and accurate
- [ ] Package can be consumed by other packages
- [ ] Rollback procedures tested and verified

### Success Criteria
- [ ] Zero breaking changes to existing packages
- [ ] 95%+ test coverage maintained
- [ ] Performance within 5% of original
- [ ] Full accessibility compliance
- [ ] Complete TypeScript type safety
- [ ] Production deployment successful

---

## Conclusion

This migration plan provides a comprehensive, step-by-step approach to extracting TreeConsole components from the reference codebase into a proper HierarchiDB package. The plan prioritizes safety, maintainability, and zero downtime through careful phasing, extensive testing, and robust rollback procedures.

The migration will result in:
- A reusable `@hierarchidb/ui-treeconsole` package
- Improved code organization and maintainability  
- Better separation of concerns
- Enhanced testing coverage
- Comprehensive documentation

Following this plan ensures successful migration while maintaining the high quality and performance standards expected in the HierarchiDB ecosystem.