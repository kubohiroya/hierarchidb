# ResourceProjectToggle

A toggle button group component for switching between Resources and Projects pages with sessionStorage integration.

## Usage

### Basic Usage

```tsx
import { ResourceProjectToggle } from '@hierarchidb/ui-core';

// Define storage keys for your application
const STORAGE_KEYS = {
  RESOURCES_PAGE_NODE_ID: 'resourcesPageNodeId',
  PROJECTS_PAGE_NODE_ID: 'projectsPageNodeId',
} as const;

function MyComponent() {
  const currentPageNodeId = useCurrentPageNodeId(); // Your implementation
  
  return (
    <ResourceProjectToggle
      selected="resources"
      currentPageNodeId={currentPageNodeId}
      appPrefix="hierarchidb"
      getSavedPageNodeId={(type) => 
        sessionStorage.getItem(
          type === 'resources' 
            ? STORAGE_KEYS.RESOURCES_PAGE_NODE_ID 
            : STORAGE_KEYS.PROJECTS_PAGE_NODE_ID
        )
      }
      savePageNodeId={(type, id) => 
        sessionStorage.setItem(
          type === 'resources' 
            ? STORAGE_KEYS.RESOURCES_PAGE_NODE_ID 
            : STORAGE_KEYS.PROJECTS_PAGE_NODE_ID,
          id
        )
      }
    />
  );
}
```

### With Node Context Validation

```tsx
import { ResourceProjectToggle } from '@hierarchidb/ui-core';
import { getNodeContext } from './utils'; // Your implementation

function MyComponentWithContext() {
  const currentPageNodeId = useCurrentPageNodeId();
  
  // Function to determine if a node belongs to resources or projects
  const handleGetNodeContext = async (pageNodeId: string) => {
    const node = await fetchNode(pageNodeId);
    return node.type === 'resource' ? 'resources' : 'projects';
  };
  
  return (
    <ResourceProjectToggle
      selected="resources"
      currentPageNodeId={currentPageNodeId}
      appPrefix="myapp"
      getSavedPageNodeId={(type) => 
        sessionStorage.getItem(`${type}PageNodeId`)
      }
      savePageNodeId={(type, id) => 
        sessionStorage.setItem(`${type}PageNodeId`, id)
      }
      getNodeContext={handleGetNodeContext}
    />
  );
}
```

### Vertical Orientation

```tsx
<ResourceProjectToggle
  selected="projects"
  currentPageNodeId={currentPageNodeId}
  appPrefix="app"
  orientation="vertical"
  size="large"
  getSavedPageNodeId={(type) => 
    localStorage.getItem(`saved_${type}_node`)
  }
  savePageNodeId={(type, id) => 
    localStorage.setItem(`saved_${type}_node`, id)
  }
/>
```

### Home Page (Neutral State)

```tsx
// When neither Resources nor Projects is selected (e.g., on home page)
<ResourceProjectToggle
  selected="none"
  appPrefix="app"
  getSavedPageNodeId={(type) => 
    sessionStorage.getItem(`${type}PageNodeId`)
  }
  savePageNodeId={(type, id) => 
    sessionStorage.setItem(`${type}PageNodeId`, id)
  }
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `selected` | `'resources' \| 'projects' \| 'none'` | `'none'` | Currently selected type |
| `currentPageNodeId` | `string \| undefined` | - | Current page node ID to preserve |
| `appPrefix` | `string` | - | App prefix for routing (required) |
| `getSavedPageNodeId` | `(type: 'resources' \| 'projects') => string \| null` | - | Callback to get saved pageNodeId |
| `savePageNodeId` | `(type: 'resources' \| 'projects', id: string) => void` | - | Callback to save pageNodeId |
| `getNodeContext` | `(pageNodeId: string) => Promise<'resources' \| 'projects'>` | - | Optional callback to validate node context |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Button group orientation |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | Button size |

## Features

- **State Preservation**: Automatically saves and restores the last visited page node ID for each section
- **Context Validation**: Optional validation to ensure nodes are saved to the correct context
- **Flexible Storage**: Use any storage mechanism via callback functions
- **Responsive Design**: Supports both horizontal and vertical orientations
- **Accessibility**: Includes proper ARIA attributes for screen readers

## Migration from Hardcoded Version

If you're migrating from the previous version with hardcoded `APP_PREFIX` and direct sessionStorage access:

### Before
```tsx
// Old usage (hardcoded)
<ResourceProjectToggle
  selected="resources"
  currentPageNodeId={pageNodeId}
/>
```

### After
```tsx
// New usage (flexible)
const STORAGE_KEYS = {
  RESOURCES_PAGE_NODE_ID: 'resourcesPageNodeId',
  PROJECTS_PAGE_NODE_ID: 'projectsPageNodeId',
};

<ResourceProjectToggle
  selected="resources"
  currentPageNodeId={pageNodeId}
  appPrefix="hierarchidb" // Now configurable
  getSavedPageNodeId={(type) => 
    sessionStorage.getItem(
      type === 'resources' 
        ? STORAGE_KEYS.RESOURCES_PAGE_NODE_ID 
        : STORAGE_KEYS.PROJECTS_PAGE_NODE_ID
    )
  }
  savePageNodeId={(type, id) => 
    sessionStorage.setItem(
      type === 'resources' 
        ? STORAGE_KEYS.RESOURCES_PAGE_NODE_ID 
        : STORAGE_KEYS.PROJECTS_PAGE_NODE_ID,
      id
    )
  }
/>
```