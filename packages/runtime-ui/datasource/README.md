# @hierarchidb/ui-datasource

Reusable data source selection and license agreement components for HierarchiDB plugins.

## Overview

This package provides UI components for handling data source selection and license agreements across multiple HierarchiDB plugins (shapes, location, resource). It includes comprehensive data source definitions with licensing information and usage limitations.

## Components

### DataSourceSelector

Grid-based data source selection component with filtering and license information display.

```tsx
import { DataSourceSelector } from '@hierarchidb/ui-datasource';

<DataSourceSelector
  selectedDataSource={selectedDataSource}
  onSelectionChange={handleDataSourceChange}
  filterByCategory="geographic"
  gridColumns={2}
  showLicenseInfo={true}
  showLimitations={true}
/>
```

### DataSourceLicenseAgreement

License agreement component with automatic license page opening and agreement tracking.

```tsx
import { DataSourceLicenseAgreement } from '@hierarchidb/ui-datasource';

<DataSourceLicenseAgreement
  dataSource="naturalearth"
  onLicenseOpened={handleLicenseAgreed}
  agreed={licenseAgreed}
/>
```

### Step Components

High-level step components for use in multi-step dialogs:

```tsx
import { DataSourceSelectionStep, DataSourceLicenseStep } from '@hierarchidb/ui-datasource';

// Step 1: Data Source Selection
<DataSourceSelectionStep
  selectedDataSource={selectedDataSource}
  onDataSourceChange={handleDataSourceChange}
  filterByCategory="geographic"
/>

// Step 2: License Agreement
<DataSourceLicenseStep
  selectedDataSource={selectedDataSource}
  onLicenseAgreed={handleLicenseAgreed}
  licenseAgreed={licenseAgreed}
/>
```

## Data Sources

The package includes comprehensive definitions for 11 data sources across three categories:

### Geographic Data Sources
- **Natural Earth** - Public domain global mapping data
- **geoBoundaries** - Open administrative boundaries dataset
- **GADM** - Global Administrative Areas database
- **OpenStreetMap** - Community-driven mapping data
- **World Bank Official Boundaries** - World Bank administrative data

### Location Data Sources
- **GeoNames** - Geographical names database
- **OpenStreetMap (Places)** - Location and point of interest data

### Route Data Sources
- **OpenRouteService** - Routing and isochrone services
- **OSRM** - Open Source Routing Machine
- **GraphHopper** - Route optimization services
- **Mapbox Directions** - Commercial routing API

## Utilities

```tsx
import {
  getDataSourceConfig,
  getDataSourcesByCategory,
  getLicenseColor,
  extractLimitations,
} from '@hierarchidb/ui-datasource';

// Get configuration for a specific data source
const config = getDataSourceConfig('naturalearth');

// Filter data sources by category
const geoSources = getDataSourcesByCategory('geographic');

// Get Material-UI color for license type
const color = getLicenseColor('public'); // 'success'

// Extract usage limitations from description
const limitations = extractLimitations(config.description);
```

## License Color Coding

- **Public Domain**: Green (success)
- **Academic**: Blue (info)  
- **ODbL**: Orange (warning)
- **Creative Commons**: Light Blue (info)
- **MIT**: Green (success)

## Dependencies

- `@mui/material` - Material-UI components
- `@mui/icons-material` - Material-UI icons
- `react` - React framework

## Usage in Plugins

This package is designed to be used across multiple HierarchiDB plugins:

- **Shapes Plugin**: Geographic boundary data selection
- **Location Plugin**: Place and POI data source selection
- **Resource Plugin**: Route and navigation data source selection

Each plugin can filter data sources by category and customize the UI presentation while maintaining consistent licensing and agreement workflows.