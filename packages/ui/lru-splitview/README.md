# @hierarchidb/ui-lru-splitview

An intelligent, LRU-managed split view component system for complex multi-pane interfaces. Features automatic pane management, progress tracking, and customizable auto-expand behavior.

## Overview

This package provides a sophisticated split view system designed for applications that need to display multiple related processes or information streams simultaneously. It uses LRU (Least Recently Used) logic to intelligently manage pane visibility and expansion, ensuring optimal screen real estate usage.

## Key Features

- 🧠 **LRU-based Pane Management** - Automatically manages which panes are expanded based on usage patterns
- 📊 **Progress Tracking** - Built-in support for task progress display and auto-expansion
- 🔄 **Auto-expand Logic** - Intelligent expansion based on completion, task start, or custom rules
- ⚡ **Performance Optimized** - Efficient rendering and smooth transitions using Allotment
- 🎨 **Highly Customizable** - Flexible pane headers, content, and styling options
- 📱 **Responsive** - Adapts to different screen sizes and orientations

## Installation

```bash
pnpm add @hierarchidb/ui-lru-splitview
```

## Quick Start

### Basic Usage

```tsx
import React, { useState } from 'react';
import { 
  LRUSplitView, 
  createPane, 
  createProgress 
} from '@hierarchidb/ui-lru-splitview';

function MyApp() {
  const [progress, setProgress] = useState([
    createProgress('pane1', 75, { taskCount: 10, completedCount: 7 }),
    createProgress('pane2', 30, { taskCount: 5, completedCount: 2 }),
  ]);

  const panes = [
    createPane('pane1', 'Download Tasks', <div>Download content here</div>),
    createPane('pane2', 'Processing Tasks', <div>Processing content here</div>),
    createPane('pane3', 'Results', <div>Results content here</div>),
  ];

  return (
    <LRUSplitView
      panes={panes}
      progress={progress}
      maxExpandedPanes={2}
      autoExpand={{
        onComplete: true,
        onStart: true,
      }}
      height="600px"
    />
  );
}
```

### Advanced Configuration

```tsx
import React from 'react';
import {
  LRUSplitView,
  createPane,
  AutoExpandPresets,
} from '@hierarchidb/ui-lru-splitview';
import { Download, Process, Check } from '@mui/icons-material';

function AdvancedSplitView() {
  const panes = [
    createPane('download', 'File Downloads', <DownloadPanel />, {
      icon: <Download />,
      color: '#e3f2fd',
      defaultExpanded: true,
      headerActions: <DownloadActions />,
    }),
    createPane('process', 'Data Processing', <ProcessPanel />, {
      icon: <Process />,
      color: '#f3e5f5',
      collapsedSize: 80,
    }),
    createPane('results', 'Results & Export', <ResultsPanel />, {
      icon: <Check />,
      color: '#e8f5e8',
      customHeader: <CustomResultsHeader />,
    }),
  ];

  return (
    <LRUSplitView
      panes={panes}
      maxExpandedPanes={2}
      autoExpand={AutoExpandPresets.sequential}
      onPaneToggle={(paneId, expanded) => {
        console.log(`Pane ${paneId} ${expanded ? 'expanded' : 'collapsed'}`);
      }}
      vertical={false}
      height="100vh"
    />
  );
}
```

## Auto-Expand Presets

The package includes several predefined auto-expand behaviors:

```tsx
import { AutoExpandPresets } from '@hierarchidb/ui-lru-splitview';

// No automatic expansion
autoExpand: AutoExpandPresets.none

// Sequential workflow - expand next pane when previous completes
autoExpand: AutoExpandPresets.sequential

// Expand when tasks start processing
autoExpand: AutoExpandPresets.onStart

// Expand on both start and completion
autoExpand: AutoExpandPresets.full

// Focus on most active pane
autoExpand: AutoExpandPresets.activeFirst

// Prioritize completed panes
autoExpand: AutoExpandPresets.completedFirst
```

### Custom Auto-Expand Logic

```tsx
const customAutoExpand = {
  onComplete: false,
  onStart: false,
  custom: (progress, currentStates) => {
    // Custom logic to determine which pane to expand
    const errorPanes = progress.filter(p => p.status === 'error');
    if (errorPanes.length > 0) {
      return errorPanes[0].paneId; // Expand first error pane
    }
    
    const activePanes = progress.filter(p => p.progress > 0 && p.progress < 100);
    if (activePanes.length > 0) {
      // Expand pane with highest progress
      const mostProgress = activePanes.reduce((max, current) =>
        current.progress > max.progress ? current : max
      );
      return mostProgress.paneId;
    }
    
    return null;
  },
};
```

## Hook Usage

For more control, use the `useLRUPanes` hook directly:

```tsx
import React from 'react';
import { useLRUPanes, createPane } from '@hierarchidb/ui-lru-splitview';

function CustomSplitView() {
  const panes = [
    createPane('pane1', 'First Pane', <div>Content 1</div>),
    createPane('pane2', 'Second Pane', <div>Content 2</div>),
  ];

  const {
    paneStates,
    togglePane,
    expandPane,
    collapsePane,
    expandPanes,
    collapseAll,
    getExpandedPanes,
    getSizes,
  } = useLRUPanes({ panes, maxExpandedPanes: 2 });

  const handleExpandAll = () => {
    expandPanes(['pane1', 'pane2']);
  };

  const handleCollapseAll = () => {
    collapseAll();
  };

  const expandedPanes = getExpandedPanes();

  return (
    <div>
      <div>
        <button onClick={handleExpandAll}>Expand All</button>
        <button onClick={handleCollapseAll}>Collapse All</button>
        <p>Expanded: {expandedPanes.join(', ')}</p>
      </div>
      {/* Your custom split view implementation */}
    </div>
  );
}
```

## Progress Management

### Creating Progress Information

```tsx
import { createProgress, calculateProgress } from '@hierarchidb/ui-lru-splitview';

// Simple progress
const progress1 = createProgress('download', 75);

// Detailed progress with task counts
const progress2 = createProgress('process', 45, {
  taskCount: 20,
  completedCount: 9,
  status: 'Processing files...',
});

// Calculate progress from completed/total
const calculatedProgress = calculateProgress(7, 10); // 70%
const progress3 = createProgress('upload', calculatedProgress, {
  taskCount: 10,
  completedCount: 7,
});
```

### Batch Progress Updates

```tsx
import { batchUpdateProgress } from '@hierarchidb/ui-lru-splitview';

const [progress, setProgress] = useState([]);

const updateMultipleProgress = () => {
  const updates = [
    { paneId: 'download', progress: 100, status: 'Complete' },
    { paneId: 'process', progress: 25, taskCount: 50, completedCount: 12 },
    { paneId: 'upload', progress: 0, status: 'Starting...' },
  ];
  
  setProgress(prev => batchUpdateProgress(prev, updates));
};
```

## Utility Functions

```tsx
import {
  findLRUPane,
  findMRUPane,
  sortByAccessTime,
  getCollapsiblePanes,
  calculateOptimalSizes,
} from '@hierarchidb/ui-lru-splitview';

// Find least recently used pane
const lruPane = findLRUPane(paneStates);

// Find most recently used pane  
const mruPane = findMRUPane(paneStates);

// Sort panes by access time (most recent first)
const sortedPanes = sortByAccessTime(paneStates);

// Get panes that can be collapsed
const collapsible = getCollapsiblePanes(paneStates);

// Calculate optimal sizes
const sizes = calculateOptimalSizes(paneStates, 1000, 60);
```

## Component Props

### LRUSplitView

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `panes` | `PaneConfig[]` | Required | Array of pane configurations |
| `maxExpandedPanes` | `number` | `2` | Maximum number of expanded panes |
| `defaultCollapsedSize` | `number` | `60` | Default collapsed size (px) |
| `vertical` | `boolean` | `false` | Use vertical orientation |
| `autoExpand` | `AutoExpandConfig` | `undefined` | Auto-expand behavior |
| `progress` | `PaneProgress[]` | `[]` | Progress information for panes |
| `onPaneToggle` | `function` | `undefined` | Callback when pane toggles |
| `onPaneReorder` | `function` | `undefined` | Callback when panes reorder |
| `height` | `string \| number` | `'100%'` | Component height |
| `width` | `string \| number` | `'100%'` | Component width |

### PaneConfig

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique pane identifier |
| `title` | `string` | Display title |
| `content` | `ReactNode` | Pane body content |
| `icon` | `ReactNode` | Optional header icon |
| `color` | `string` | Background color when expanded |
| `defaultExpanded` | `boolean` | Whether pane starts expanded |
| `collapsedSize` | `number` | Minimum size when collapsed (px) |
| `headerActions` | `ReactNode` | Optional header actions |
| `customHeader` | `ReactNode` | Custom header component |

### PaneProgress

| Property | Type | Description |
|----------|------|-------------|
| `paneId` | `string` | Associated pane ID |
| `progress` | `number` | Progress percentage (0-100) |
| `taskCount` | `number` | Total number of tasks |
| `completedCount` | `number` | Number of completed tasks |
| `status` | `string` | Custom status message |

## Use Cases

### Batch Processing Monitor

Perfect for monitoring multi-stage batch operations:

```tsx
const BatchMonitor = () => {
  const panes = [
    createPane('download', 'Download Phase', <DownloadTasks />),
    createPane('process', 'Processing Phase', <ProcessTasks />),
    createPane('generate', 'Generation Phase', <GenerateTasks />),
    createPane('upload', 'Upload Phase', <UploadTasks />),
  ];

  return (
    <LRUSplitView
      panes={panes}
      autoExpand={AutoExpandPresets.sequential}
      maxExpandedPanes={2}
    />
  );
};
```

### Development Dashboard

Great for displaying multiple development streams:

```tsx
const DevDashboard = () => {
  const panes = [
    createPane('logs', 'Application Logs', <LogViewer />),
    createPane('metrics', 'Performance Metrics', <MetricsChart />),
    createPane('errors', 'Error Tracking', <ErrorList />),
    createPane('deploys', 'Deployments', <DeploymentStatus />),
  ];

  return (
    <LRUSplitView
      panes={panes}
      autoExpand={AutoExpandPresets.activeFirst}
      maxExpandedPanes={3}
      vertical={true}
    />
  );
};
```

### Data Pipeline Visualization

Ideal for showing data processing pipelines:

```tsx
const PipelineView = () => {
  const panes = [
    createPane('ingestion', 'Data Ingestion', <IngestionPanel />),
    createPane('transform', 'Transformation', <TransformPanel />),
    createPane('validation', 'Validation', <ValidationPanel />),
    createPane('output', 'Output Generation', <OutputPanel />),
  ];

  return (
    <LRUSplitView
      panes={panes}
      autoExpand={AutoExpandPresets.completedFirst}
      progress={pipelineProgress}
    />
  );
};
```

## TypeScript Support

Fully typed with comprehensive TypeScript definitions:

```tsx
import type {
  PaneConfig,
  PaneState,
  PaneProgress,
  LRUSplitViewConfig,
  UseLRUPanesResult,
} from '@hierarchidb/ui-lru-splitview';

// Type-safe pane configuration
const typedPane: PaneConfig = {
  id: 'typed-pane',
  title: 'Typed Pane',
  content: <div>Content</div>,
  defaultExpanded: false,
};

// Type-safe progress
const typedProgress: PaneProgress = {
  paneId: 'typed-pane',
  progress: 50,
  taskCount: 10,
  completedCount: 5,
};
```

## Performance Considerations

- **Efficient Rendering**: Only visible pane content is rendered
- **Smooth Transitions**: CSS transitions for expand/collapse animations
- **Memory Management**: LRU logic prevents excessive resource usage
- **Progressive Loading**: Content can be lazily loaded when panes expand

## Browser Support

Supports all modern browsers. Requires React 18+ and depends on Allotment for split view functionality.

## Dependencies

- `@mui/material` - Material-UI components and theming
- `@mui/icons-material` - Material-UI icons
- `allotment` - Split pane component (includes CSS)
- `react` - React framework

## Contributing

This package is part of the HierarchiDB ecosystem. See the main repository for contribution guidelines.

## License

MIT