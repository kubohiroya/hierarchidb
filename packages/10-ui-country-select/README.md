# @hierarchidb/ui-country-select

A comprehensive, virtualized country and matrix selection component system for HierarchiDB plugins. Supports flexible column configurations for different selection scenarios including administrative levels, transportation hubs, and route types.

## Overview

This package provides highly configurable components for selecting countries and associated data points through a matrix interface. It's designed to be reusable across different HierarchiDB plugins (shapes, location, resource, route) while maintaining excellent performance with large datasets through virtualization.

## Features

- 🌍 **Flexible Country Selection** - Support for all countries with filtering and search
- 📊 **Matrix Interface** - Checkbox matrix for selecting multiple attributes per country
- ⚡ **Virtualized Performance** - Handles thousands of countries smoothly with react-virtuoso
- 🏛️ **Predefined Column Sets** - Built-in configurations for common use cases
- 🔧 **Highly Customizable** - Create custom column configurations
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 💾 **Import/Export** - CSV and JSON support for selections
- 🎯 **Bulk Operations** - Select all, clear all, and filtered operations

## Installation

```bash
pnpm add @hierarchidb/ui-country-select
```

## Quick Start

### Basic Usage

```tsx
import React, { useState } from 'react';
import { 
  CountryMatrixSelector,
  ADMIN_LEVELS_COLUMN_SET,
  SAMPLE_COUNTRIES,
  MatrixSelection 
} from '@hierarchidb/ui-country-select';

function MyComponent() {
  const [selections, setSelections] = useState<MatrixSelection[]>([]);

  return (
    <CountryMatrixSelector
      countries={SAMPLE_COUNTRIES}
      matrixConfig={ADMIN_LEVELS_COLUMN_SET}
      selections={selections}
      onSelectionsChange={setSelections}
      height={600}
    />
  );
}
```

### Using with StepperDialog

```tsx
import React, { useState } from 'react';
import { 
  CountryMatrixStep,
  TRANSPORT_HUBS_COLUMN_SET,
  SAMPLE_COUNTRIES,
  MatrixSelection 
} from '@hierarchidb/ui-country-select';

function TransportStep() {
  const [selections, setSelections] = useState<MatrixSelection[]>([]);

  return (
    <CountryMatrixStep
      title="Select Countries and Transportation Hubs"
      description="Choose countries and the types of transportation hubs you want to include."
      countries={SAMPLE_COUNTRIES}
      matrixConfig={TRANSPORT_HUBS_COLUMN_SET}
      selections={selections}
      onSelectionsChange={setSelections}
      showValidationInfo={true}
      minSelections={1}
    />
  );
}
```

## Predefined Column Sets

The package includes several predefined column sets for common use cases:

### Administrative Levels (for Shapes/Boundaries)
```tsx
import { ADMIN_LEVELS_COLUMN_SET } from '@hierarchidb/ui-country-select';
// Includes: Country, State/Province, County/Region, Municipality
```

### Transportation Hubs (for Location/POI)
```tsx
import { TRANSPORT_HUBS_COLUMN_SET } from '@hierarchidb/ui-country-select';
// Includes: Airports, Ports, Railway Stations, Highway Interchanges
```

### Route Types (for Route/Connection data)
```tsx
import { ROUTE_TYPES_COLUMN_SET } from '@hierarchidb/ui-country-select';
// Includes: Air Routes, Sea Routes, Rail Routes, Road Routes
```

### Specialized Sets
```tsx
import { AIRPORTS_COLUMN_SET, PORTS_COLUMN_SET } from '@hierarchidb/ui-country-select';
// AIRPORTS_COLUMN_SET: Major Airports, Regional Airports, Cargo Airports
// PORTS_COLUMN_SET: Major Ports, Passenger Ports, Fishing Ports
```

## Custom Column Configuration

Create your own column configurations:

```tsx
import { MatrixConfig, MatrixColumn } from '@hierarchidb/ui-country-select';
import { School, Hospital, ShoppingMall } from '@mui/icons-material';

const customColumns: MatrixColumn[] = [
  {
    type: 'custom',
    id: 'schools',
    label: 'Schools',
    description: 'Educational institutions',
    icon: School,
    defaultEnabled: true,
  },
  {
    type: 'custom',
    id: 'hospitals',
    label: 'Hospitals',
    description: 'Healthcare facilities',
    icon: Hospital,
    defaultEnabled: false,
  },
  {
    type: 'custom',
    id: 'malls',
    label: 'Shopping Malls',
    description: 'Commercial centers',
    icon: ShoppingMall,
    defaultEnabled: false,
  },
];

const customConfig: MatrixConfig = {
  columns: customColumns,
  allowBulkSelect: true,
  showColumnHeaders: true,
  showFilters: true,
  virtualization: {
    rowHeight: 56,
    overscan: 5,
  },
};
```

## State Management Hook

Use the provided hook for advanced state management:

```tsx
import { useCountrySelection } from '@hierarchidb/ui-country-select';

function MyComponent() {
  const {
    selections,
    setSelections,
    updateSelection,
    selectAllForCountries,
    clearAll,
    stats,
    isSelected,
    getCountrySelections,
  } = useCountrySelection({
    minSelections: 1,
  });

  // Individual selection
  const handleCountryColumnSelect = (countryCode: string, columnId: string, selected: boolean) => {
    updateSelection(countryCode, columnId, selected);
  };

  // Bulk operations
  const handleSelectAllAirports = () => {
    const countryCodes = ['US', 'GB', 'DE', 'FR', 'JP'];
    selectAllForCountries(countryCodes, ['airports']);
  };

  return (
    <div>
      <p>Selected: {stats.totalCountries} countries, {stats.totalSelections} total selections</p>
      <p>Valid: {stats.isValid ? 'Yes' : 'No'}</p>
      {/* Your UI here */}
    </div>
  );
}
```

## Import/Export Functionality

```tsx
import { 
  exportSelections, 
  importSelections,
  selectionsToCSV,
  csvToSelections 
} from '@hierarchidb/ui-country-select';

// Export to JSON
const exportData = exportSelections(selections, columns, countries);
const jsonString = JSON.stringify(exportData, null, 2);

// Import from JSON
const importData = JSON.parse(jsonString);
const { selections: importedSelections } = importSelections(importData);

// Export to CSV
const csvData = selectionsToCSV(selections, columns, countries);

// Import from CSV
const importedFromCsv = csvToSelections(csvData, columns);
```

## Filtering and Search

Built-in filtering capabilities:

```tsx
<CountryMatrixSelector
  countries={SAMPLE_COUNTRIES}
  matrixConfig={ADMIN_LEVELS_COLUMN_SET}
  selections={selections}
  onSelectionsChange={setSelections}
  initialFilter={{
    continent: 'EU',
    minPopulation: 1000000,
    maxPopulation: 100000000,
    searchQuery: 'Germany',
  }}
/>
```

## Component Props

### CountryMatrixSelector

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `countries` | `Country[]` | Required | Array of available countries |
| `matrixConfig` | `MatrixConfig` | Required | Matrix configuration with columns |
| `selections` | `MatrixSelection[]` | Required | Current selections state |
| `onSelectionsChange` | `function` | Required | Callback when selections change |
| `initialFilter` | `CountryFilter` | `{}` | Initial filter state |
| `height` | `number` | `600` | Component height in pixels |
| `showBulkTools` | `boolean` | `true` | Show bulk selection tools |
| `showCountryInfo` | `boolean` | `true` | Show country information columns |
| `rowHeight` | `number` | `56` | Row height for virtualization |

### CountryMatrixStep

Extends `CountryMatrixSelector` props with additional step-specific props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `'Select Countries and Options'` | Step title |
| `description` | `string` | `undefined` | Step description |
| `showValidationInfo` | `boolean` | `true` | Show validation information |
| `minSelections` | `number` | `1` | Minimum required selections |
| `showConfiguration` | `boolean` | `false` | Show configuration accordion |

## Performance

- **Virtualization**: Uses `react-virtuoso` for smooth scrolling with thousands of rows
- **Optimized Rendering**: Memoized components and efficient state updates
- **Lazy Loading**: Country data can be loaded progressively
- **Memory Efficient**: Only renders visible rows plus overscan

## Use Cases

### Plugin Scenarios

1. **Shapes Plugin**: Administrative level selection per country
   ```tsx
   matrixConfig={ADMIN_LEVELS_COLUMN_SET}
   ```

2. **Location Plugin**: Transportation hub selection
   ```tsx
   matrixConfig={TRANSPORT_HUBS_COLUMN_SET}
   ```

3. **Resource Plugin**: Resource type selection per country
   ```tsx
   matrixConfig={customResourceColumnSet}
   ```

4. **Route Plugin**: Route type selection
   ```tsx
   matrixConfig={ROUTE_TYPES_COLUMN_SET}
   ```

### Data Analysis

- Export selections for processing in external tools
- Generate reports on country coverage
- Track selection patterns across different scenarios

## TypeScript Support

Fully typed with TypeScript for excellent development experience:

```tsx
import type {
  Country,
  MatrixSelection,
  MatrixConfig,
  ColumnSet,
  AdminLevelColumn,
  TransportHubColumn,
} from '@hierarchidb/ui-country-select';
```

## Dependencies

- `@mui/material` - Material-UI components
- `@mui/icons-material` - Material-UI icons
- `react-virtuoso` - Virtualized scrolling
- `react` - React framework

## Browser Support

Supports all modern browsers. Requires React 18+.

## Contributing

This package is part of the HierarchiDB ecosystem. See the main repository for contribution guidelines.

## License

MIT