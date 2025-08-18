# TreeToggleButtonGroup

A flexible button group component for toggling between multiple tree views with customizable configuration.

## Features

- **Flexible Tree Configuration**: Support for any number of tree views
- **Customizable Appearance**: Each tree can have its own icon, color, and tooltip
- **State Preservation**: Automatically saves and restores the last visited page node ID for each tree
- **Context Validation**: Optional validation to ensure nodes are saved to the correct tree
- **Responsive Design**: Supports horizontal and vertical orientations
- **Accessibility**: Includes proper ARIA attributes

## Usage

### Basic Usage with Two Trees (Resources & Projects)

```tsx
import { TreeToggleButtonGroup } from '@hierarchidb/ui-core';
import { AttachmentIcon, MapIcon } from '@mui/icons-material';

const trees = [
  {
    id: 'resources',
    label: 'Resources',
    icon: AttachmentIcon,
    routePath: 'r',
    color: 'primary' as const,
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: MapIcon,
    routePath: 'p',
    color: 'secondary' as const,
  },
];

function MyComponent() {
  const [selectedTreeId, setSelectedTreeId] = useState('resources');
  const currentPageNodeId = useCurrentPageNodeId();
  
  return (
    <TreeToggleButtonGroup
      trees={trees}
      selectedTreeId={selectedTreeId}
      currentPageNodeId={currentPageNodeId}
      appPrefix="hierarchidb"
      getSavedPageNodeId={(treeId) => 
        sessionStorage.getItem(`${treeId}PageNodeId`)
      }
      savePageNodeId={(treeId, nodeId) => 
        sessionStorage.setItem(`${treeId}PageNodeId`, nodeId)
      }
      onTreeSelect={setSelectedTreeId}
    />
  );
}
```

### Multiple Trees with Custom Configuration

```tsx
import { 
  TreeToggleButtonGroup, 
  TreeConfig 
} from '@hierarchidb/ui-core';
import { 
  FolderIcon, 
  ArticleIcon, 
  ImageIcon,
  VideoLibraryIcon 
} from '@mui/icons-material';

const trees: TreeConfig[] = [
  {
    id: 'documents',
    label: 'Documents',
    icon: ArticleIcon,
    routePath: 'docs',
    color: 'primary',
    tooltip: 'View all documents',
  },
  {
    id: 'images',
    label: 'Images',
    icon: ImageIcon,
    routePath: 'img',
    color: 'success',
    tooltip: 'Browse image gallery',
  },
  {
    id: 'videos',
    label: 'Videos',
    icon: VideoLibraryIcon,
    routePath: 'vid',
    color: 'info',
    tooltip: 'Video library',
  },
  {
    id: 'archives',
    label: 'Archives',
    icon: FolderIcon,
    routePath: 'arch',
    color: 'warning',
    tooltip: 'Archived content',
    disabled: false, // Can be dynamically controlled
  },
];

function MultiTreeComponent() {
  return (
    <TreeToggleButtonGroup
      trees={trees}
      selectedTreeId="documents"
      appPrefix="myapp"
      getSavedPageNodeId={(treeId) => 
        localStorage.getItem(`tree_${treeId}_lastNode`)
      }
      savePageNodeId={(treeId, nodeId) => 
        localStorage.setItem(`tree_${treeId}_lastNode`, nodeId)
      }
    />
  );
}
```

### With Node Context Validation

```tsx
import { TreeToggleButtonGroup, TreeConfig } from '@hierarchidb/ui-core';

// Function to determine which tree a node belongs to
async function getNodeTreeId(nodeId: string): Promise<string | null> {
  const node = await fetchNodeMetadata(nodeId);
  
  switch (node.type) {
    case 'resource':
      return 'resources';
    case 'project':
      return 'projects';
    case 'template':
      return 'templates';
    default:
      return null;
  }
}

function ValidatedTreeToggle() {
  const trees: TreeConfig[] = [
    // ... tree configurations
  ];
  
  return (
    <TreeToggleButtonGroup
      trees={trees}
      selectedTreeId={currentTreeId}
      currentPageNodeId={currentNodeId}
      appPrefix="app"
      getSavedPageNodeId={(treeId) => 
        sessionStorage.getItem(`${treeId}PageNodeId`)
      }
      savePageNodeId={(treeId, nodeId) => 
        sessionStorage.setItem(`${treeId}PageNodeId`, nodeId)
      }
      getNodeTreeId={getNodeTreeId}
    />
  );
}
```

### Using Helper Functions

```tsx
import { 
  TreeToggleButtonGroup,
  createResourcesTreeConfig,
  createProjectsTreeConfig 
} from '@hierarchidb/ui-core';
import { AttachmentIcon, MapIcon } from '@mui/icons-material';

const trees = [
  createResourcesTreeConfig(AttachmentIcon, {
    tooltip: 'Browse resources',
  }),
  createProjectsTreeConfig(MapIcon, {
    tooltip: 'View projects',
  }),
];

// Use in component...
```

### Vertical Orientation

```tsx
<TreeToggleButtonGroup
  trees={trees}
  selectedTreeId={selectedTreeId}
  orientation="vertical"
  size="large"
  appPrefix="app"
  getSavedPageNodeId={(treeId) => 
    sessionStorage.getItem(`${treeId}PageNodeId`)
  }
  savePageNodeId={(treeId, nodeId) => 
    sessionStorage.setItem(`${treeId}PageNodeId`, nodeId)
  }
  sx={{
    width: '200px',
    '& .MuiButton-root': {
      paddingLeft: 2,
      paddingRight: 2,
    },
  }}
/>
```

### Responsive with Label Control

```tsx
<TreeToggleButtonGroup
  trees={trees}
  selectedTreeId={selectedTreeId}
  appPrefix="app"
  showLabelsOnSmallScreens={true} // Always show labels
  getSavedPageNodeId={(treeId) => 
    sessionStorage.getItem(`${treeId}PageNodeId`)
  }
  savePageNodeId={(treeId, nodeId) => 
    sessionStorage.setItem(`${treeId}PageNodeId`, nodeId)
  }
/>
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `trees` | `TreeConfig[]` | Yes | - | Array of tree configurations |
| `selectedTreeId` | `string \| null` | Yes | - | Currently selected tree ID |
| `appPrefix` | `string` | Yes | - | App prefix for routing |
| `getSavedPageNodeId` | `(treeId: string) => string \| null` | Yes | - | Callback to get saved page node ID |
| `savePageNodeId` | `(treeId: string, nodeId: string) => void` | Yes | - | Callback to save page node ID |
| `currentPageNodeId` | `string` | No | - | Current page node ID to preserve |
| `getNodeTreeId` | `(nodeId: string) => Promise<string \| null>` | No | - | Validate which tree a node belongs to |
| `orientation` | `'horizontal' \| 'vertical'` | No | `'horizontal'` | Button group orientation |
| `size` | `'small' \| 'medium' \| 'large'` | No | `'medium'` | Button size |
| `showLabelsOnSmallScreens` | `boolean` | No | `false` | Show labels on small screens |
| `sx` | `object` | No | - | Custom MUI sx styles |
| `onTreeSelect` | `(treeId: string) => void` | No | - | Callback when tree is selected |

## TreeConfig Interface

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for the tree |
| `label` | `string` | Yes | Display label for the button |
| `icon` | `React.ComponentType` | Yes | Icon component to display |
| `routePath` | `string` | Yes | Route path segment |
| `color` | `MUI Color` | No | MUI button color |
| `tooltip` | `string` | No | Tooltip text (defaults to label) |
| `disabled` | `boolean` | No | Whether the tree option is disabled |

## Migration from ResourceProjectToggle

The TreeToggleButtonGroup is a more flexible alternative to ResourceProjectToggle:

### Before (ResourceProjectToggle)
```tsx
<ResourceProjectToggle
  selected="resources"
  currentPageNodeId={pageNodeId}
  appPrefix="app"
  getSavedPageNodeId={(type) => 
    sessionStorage.getItem(`${type}PageNodeId`)
  }
  savePageNodeId={(type, id) => 
    sessionStorage.setItem(`${type}PageNodeId`, id)
  }
/>
```

### After (TreeToggleButtonGroup)
```tsx
const trees = [
  {
    id: 'resources',
    label: 'Resources',
    icon: AttachmentIcon,
    routePath: 'r',
    color: 'primary',
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: MapIcon,
    routePath: 'p',
    color: 'secondary',
  },
];

<TreeToggleButtonGroup
  trees={trees}
  selectedTreeId="resources"
  currentPageNodeId={pageNodeId}
  appPrefix="app"
  getSavedPageNodeId={(treeId) => 
    sessionStorage.getItem(`${treeId}PageNodeId`)
  }
  savePageNodeId={(treeId, nodeId) => 
    sessionStorage.setItem(`${treeId}PageNodeId`, nodeId)
  }
/>
```

## Advanced Examples

### Dynamic Tree List

```tsx
function DynamicTreeToggle() {
  const [trees, setTrees] = useState<TreeConfig[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  
  useEffect(() => {
    // Load available trees from API
    fetchAvailableTrees().then(data => {
      const treeConfigs = data.map(tree => ({
        id: tree.id,
        label: tree.name,
        icon: getIconForTreeType(tree.type),
        routePath: tree.routePath,
        color: tree.theme as any,
        disabled: !tree.accessible,
      }));
      setTrees(treeConfigs);
      setSelectedTreeId(treeConfigs[0]?.id || null);
    });
  }, []);
  
  return (
    <TreeToggleButtonGroup
      trees={trees}
      selectedTreeId={selectedTreeId}
      appPrefix="app"
      getSavedPageNodeId={(treeId) => 
        sessionStorage.getItem(`${treeId}PageNodeId`)
      }
      savePageNodeId={(treeId, nodeId) => 
        sessionStorage.setItem(`${treeId}PageNodeId`, nodeId)
      }
      onTreeSelect={setSelectedTreeId}
    />
  );
}
```

### With Custom Storage Backend

```tsx
class TreeStateManager {
  private storage = new Map<string, string>();
  
  getPageNodeId(treeId: string): string | null {
    return this.storage.get(`${treeId}_node`) || null;
  }
  
  setPageNodeId(treeId: string, nodeId: string): void {
    this.storage.set(`${treeId}_node`, nodeId);
    // Optionally sync to backend
    this.syncToBackend(treeId, nodeId);
  }
  
  private async syncToBackend(treeId: string, nodeId: string) {
    await fetch('/api/tree-state', {
      method: 'POST',
      body: JSON.stringify({ treeId, nodeId }),
    });
  }
}

const stateManager = new TreeStateManager();

function CustomStorageExample() {
  return (
    <TreeToggleButtonGroup
      trees={trees}
      selectedTreeId={selectedTreeId}
      appPrefix="app"
      getSavedPageNodeId={(treeId) => 
        stateManager.getPageNodeId(treeId)
      }
      savePageNodeId={(treeId, nodeId) => 
        stateManager.setPageNodeId(treeId, nodeId)
      }
    />
  );
}
```