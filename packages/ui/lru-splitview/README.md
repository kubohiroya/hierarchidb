# @hierarchidb/ui-lru-splitview

LRU-managed split view for multi-pane interfaces with auto-expansion and progress-aware behavior.

## Directory layout
```
components/   LRUSplitView, PaneHeader
hooks/        useLRUPanes
types/        PaneConfig/State/Progress, props
utils/        createPane/createProgress, sizing + auto-expand helpers
index.ts      Public exports
```

## Key exports
- `LRUSplitView` — controlled panes with `maxExpandedPanes`, `autoExpand`, `progress`, `vertical`, `height`.
- Helpers: `createPane`, `createProgress`, `AutoExpandPresets`, sizing/ordering utilities.
- Hook: `useLRUPanes` to manage pane state externally.

## Consumers / usage
- Used for download/process/result panels in app dialogs; can drive expansion based on progress.

## Notes
- Built on Allotment for splitter layout; pass `progress` to auto-expand on start/complete.

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
| `responsiveBreakpoints` | `number[]` | `undefined` | Max-width breakpoints (px, ascending) |
| `initialPaneSizesByBreakpoint` | `number[][]` | `undefined` | Initial pane sizes per breakpoint (px, length = panes) |
| `autoCloseCountsByBreakpoint` | `number[]` | `undefined` | Auto-close counts per breakpoint (0 disables auto open/close) |
| `defaultCollapsedSize` | `number` | `60` | Default collapsed size (px) |
| `vertical` | `boolean` | `false` | Use vertical orientation |
| `autoExpand` | `AutoExpandConfig` | `undefined` | Auto-expand behavior |
| `progress` | `PaneProgress[]` | `[]` | Progress information for panes |
| `onPaneToggle` | `function` | `undefined` | Callback when pane toggles |
| `onPaneReorder` | `function` | `undefined` | Callback when panes reorder |
| `height` | `string \| number` | `'100%'` | Component height |
| `width` | `string \| number` | `'100%'` | Component width |

Responsive arrays use the breakpoint index `0..breakpoints.length`, where index `i` applies when `viewportWidth <= breakpoints[i]` and the last entry applies above the final breakpoint.

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
