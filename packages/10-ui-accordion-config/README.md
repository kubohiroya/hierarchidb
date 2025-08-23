# @hierarchidb/ui-accordion-config

A comprehensive and flexible accordion component library for React applications with Material-UI.

## Features

### 🎯 Core Components

- **BaseAccordion** - Foundational accordion with maximum flexibility
- **StyledAccordion** - Pre-styled variants (default, outlined, filled, elevated)
- **GroupedAccordion** - Manage multiple accordions with exclusive expansion
- **CollapsibleSection** - Lightweight collapsible content without full accordion styling

### 🎨 Preset Components

- **WorkflowAccordion** - Specialized for multi-step workflows and processes
- **SettingsAccordion** - Built for configuration panels with save/reset actions

### 🪝 Hooks

- **useAccordionState** - Complete state management for accordion groups

## Installation

```bash
pnpm add @hierarchidb/ui-accordion-config
```

## Quick Start

### Basic Usage

```tsx
import { BaseAccordion } from '@hierarchidb/ui-accordion-config';

function MyComponent() {
  return (
    <BaseAccordion
      title="Basic Accordion"
      subtitle="Optional description"
      defaultExpanded={true}
    >
      <div>Your content here</div>
    </BaseAccordion>
  );
}
```

### Styled Variants

```tsx
import { StyledAccordion } from '@hierarchidb/ui-accordion-config';

function StyledExample() {
  return (
    <>
      {/* Outlined variant */}
      <StyledAccordion
        variant="outlined"
        title="Outlined Accordion"
        colorScheme="primary"
      >
        Content
      </StyledAccordion>

      {/* Filled with gradient */}
      <StyledAccordion
        variant="filled"
        colorScheme="success"
        gradient={true}
        title="Gradient Accordion"
      >
        Content
      </StyledAccordion>

      {/* Elevated with shadow */}
      <StyledAccordion
        variant="elevated"
        title="Elevated Accordion"
        borderRadius="large"
      >
        Content
      </StyledAccordion>
    </>
  );
}
```

### Grouped Accordions

```tsx
import { GroupedAccordion } from '@hierarchidb/ui-accordion-config';

function GroupExample() {
  const items = [
    {
      key: 'general',
      title: 'General Settings',
      icon: <SettingsIcon />,
      content: <GeneralSettings />
    },
    {
      key: 'advanced',
      title: 'Advanced Settings',
      content: <AdvancedSettings />
    }
  ];

  return (
    <GroupedAccordion
      title="Configuration"
      items={items}
      exclusive={true} // Only one open at a time
      defaultExpanded={['general']}
      onExpansionChange={(keys) => console.log('Expanded:', keys)}
    />
  );
}
```

### Workflow/Process Accordions

```tsx
import { WorkflowAccordion } from '@hierarchidb/ui-accordion-config';

function ProcessFlow() {
  return (
    <>
      <WorkflowAccordion
        step={{
          id: 1,
          label: 'Data Collection',
          status: 'completed'
        }}
        title="Collect Input Data"
        colorScheme="success"
      >
        Step 1 content
      </WorkflowAccordion>

      <WorkflowAccordion
        step={{
          id: 2,
          label: 'Processing',
          status: 'active'
        }}
        title="Process Data"
        colorScheme="primary"
      >
        Step 2 content
      </WorkflowAccordion>
    </>
  );
}
```

### Settings with Actions

```tsx
import { SettingsAccordion } from '@hierarchidb/ui-accordion-config';

function ConfigPanel() {
  const [hasChanges, setHasChanges] = useState(false);

  return (
    <SettingsAccordion
      title="Database Configuration"
      hasChanges={hasChanges}
      onSave={() => saveSettings()}
      onReset={() => resetSettings()}
      showSettingsIcon={true}
    >
      <DatabaseConfig onChange={() => setHasChanges(true)} />
    </SettingsAccordion>
  );
}
```

### State Management Hook

```tsx
import { useAccordionState, GroupedAccordion } from '@hierarchidb/ui-accordion-config';

function ManagedAccordions() {
  const accordionState = useAccordionState({
    defaultExpanded: ['item1'],
    exclusive: true,
    onChange: (keys) => console.log('Changed:', keys)
  });

  return (
    <div>
      <button onClick={() => accordionState.expandAll()}>
        Expand All
      </button>
      <button onClick={() => accordionState.collapseAll()}>
        Collapse All
      </button>
      
      <BaseAccordion
        title="Item 1"
        defaultExpanded={accordionState.isExpanded('item1')}
        onExpansionChange={() => accordionState.toggle('item1')}
      >
        Content 1
      </BaseAccordion>
      
      <BaseAccordion
        title="Item 2"
        defaultExpanded={accordionState.isExpanded('item2')}
        onExpansionChange={() => accordionState.toggle('item2')}
      >
        Content 2
      </BaseAccordion>
    </div>
  );
}
```

## API Reference

### BaseAccordion Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | - | Accordion title |
| `subtitle` | `string` | - | Optional subtitle |
| `icon` | `ReactNode` | - | Custom icon |
| `defaultExpanded` | `boolean` | `false` | Initial expansion state |
| `disabled` | `boolean` | `false` | Disable accordion |
| `headerActions` | `ReactNode` | - | Actions in header |
| `expandIcon` | `ReactNode` | `<ExpandMore />` | Custom expand icon |
| `expandIconPosition` | `'start' \| 'end'` | `'end'` | Icon position |
| `showDivider` | `boolean` | `false` | Show header divider |
| `elevation` | `number` | `1` | Shadow depth |
| `onExpansionChange` | `(expanded: boolean) => void` | - | Change callback |

### StyledAccordion Props

Extends `BaseAccordion` with:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'outlined' \| 'filled' \| 'elevated'` | `'default'` | Visual variant |
| `colorScheme` | `'default' \| 'primary' \| 'secondary' \| ...` | `'default'` | Color scheme |
| `customColor` | `string` | - | Custom background color |
| `gradient` | `boolean` | `false` | Use gradient background |
| `borderRadius` | `'none' \| 'small' \| 'medium' \| 'large'` | `'medium'` | Border radius |
| `padding` | `'none' \| 'small' \| 'medium' \| 'large'` | `'medium'` | Content padding |

### useAccordionState Hook

```tsx
const state = useAccordionState({
  defaultExpanded: string[],
  exclusive?: boolean,
  onChange?: (keys: string[]) => void,
  allKeys?: string[]
});

// Returns:
{
  expanded: Set<string>,
  isExpanded: (key: string) => boolean,
  toggle: (key: string) => void,
  expand: (key: string) => void,
  collapse: (key: string) => void,
  expandAll: () => void,
  collapseAll: () => void,
  setExpanded: (keys: string[]) => void,
  getExpandedKeys: () => string[]
}
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```tsx
import type {
  BaseAccordionProps,
  StyledAccordionProps,
  AccordionVariant,
  AccordionColorScheme,
  GroupedAccordionProps,
  AccordionGroupItem,
  WorkflowStep,
  AccordionState
} from '@hierarchidb/ui-accordion-config';
```

## Theming

Components automatically adapt to your Material-UI theme:

```tsx
import { ThemeProvider, createTheme } from '@mui/material';
import { StyledAccordion } from '@hierarchidb/ui-accordion-config';

const theme = createTheme({
  palette: {
    mode: 'dark', // Accordions will adapt
  }
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <StyledAccordion title="Dark Mode Accordion">
        Content
      </StyledAccordion>
    </ThemeProvider>
  );
}
```

## License

MIT