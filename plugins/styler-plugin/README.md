# @hierarchidb/plugin-styler

Implementation Summary (2025-09-09)
- nodeType: `styler`
- Role: Data-driven styling and visualization across datasets
- DB: CSV メタ等の永続ストア（スタイル/メタの保存）
- UI: ルールエディタ、プレビュー、検証、エクスポート
- Features: 条件付きスタイル、パフォーマンス最適化、複数フォーマット入出力

A powerful data styling and visualization plugin for HierarchiDB that enables advanced data analysis, style generation, and map visualization with sophisticated filtering and rendering capabilities.

## Overview

The Styler Plugin provides comprehensive data styling capabilities including:

- Data import and analysis from multiple formats (CSV, Excel, JSON, GeoJSON)
- Advanced style generation with data-driven styling
- Sophisticated filtering and conditional styling
- Performance optimization for large datasets
- Multiple export formats for data and styles
- Real-time data validation and quality monitoring

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Advanced Features](#advanced-features)
- [User Guide](#user-guide)
- [Configuration](#configuration)
- [Examples](#examples)

## Installation

```bash
# Install the plugin
pnpm add @hierarchidb/plugin-styler-plugin

# Peer dependencies
pnpm add @hierarchidb/core @hierarchidb/runtime-worker-worker @hierarchidb/ui-core
```

## Quick Start

### Plugin Registration

```typescript
import { NodeTypeRegistry } from '@hierarchidb/worker';
import { StylerDefinition } from '@hierarchidb/plugin-styler-plugin';

// Register the Styler plugin
NodeTypeRegistry.getInstance().register(StylerDefinition);
```

### Creating a Styler

```typescript
import { createStyler } from '@hierarchidb/plugin-styler-plugin';

const stylerData = {
  name: 'Population Density',
  description: 'Color-coded population density visualization',
  dataSource: {
    type: 'csv',
    url: 'https://example.com/population-data.csv',
  },
  columnMapping: {
    id: 'region_id',
    value: 'population_density',
    label: 'region_name',
  },
  colorMapping: {
    type: 'continuous',
    field: 'population_density',
    stops: [
      [0, '#fff5f0'],
      [100, '#fee0d2'],
      [500, '#fcbba1'],
      [1000, '#fc9272'],
      [2000, '#fb6a4a'],
      [5000, '#de2d26'],
      [10000, '#a50f15'],
    ],
  },
};

const styler = await createStyler(stylerData);
```

### Using Styler UI Components

```typescript
import { StylerDialog, StylerImport } from '@hierarchidb/plugin-styler-plugin';

// Create/Edit Dialog
<StylerDialog
  nodeId={nodeId}
  isOpen={isDialogOpen}
  onClose={() => setIsDialogOpen(false)}
  onSave={handleSave}
  mode="create"
/>

// Data Import Component
<StylerImport
  onDataImport={handleDataImport}
  supportedFormats={['csv', 'excel', 'json', 'geojson']}
/>
```

## Core Concepts

### Styler Entity

A Styler is a `PeerEntity` that defines data styling and visualization rules:

```typescript
interface StylerEntity extends PeerEntity {
  // Basic information
  name: string;
  description: string;
  
  // Data configuration
  dataSource: DataSourceConfig;
  columnMapping: ColumnMapping;
  
  // Styling configuration
  colorMapping: ColorMapping;
  sizeMapping?: SizeMapping;
  shapeMapping?: ShapeMapping;
  
  // Filtering rules
  filterRules: FilterRule[];
  
  // Performance optimization
  optimizationSettings: OptimizationSettings;
  
  // Analytics and metadata
  analytics: StylerAnalytics;
  metadata: TableMetadata;
  
  // Lifecycle
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}
```

### Data Source Configuration

Styler supports multiple data source types:

```typescript
interface DataSourceConfig {
  type: 'csv' | 'excel' | 'json' | 'geojson' | 'url' | 'upload';
  url?: string;
  data?: any;
  options?: {
    delimiter?: string;     // For CSV
    sheetName?: string;     // For Excel
    encoding?: string;      // File encoding
    headers?: boolean;      // First row contains headers
  };
}
```

### Column Mapping

Map data columns to styling properties:

```typescript
interface ColumnMapping {
  id: string;              // Unique identifier column
  value: string;           // Primary value column for styling
  label?: string;          // Display label column
  category?: string;       // Category/group column
  latitude?: string;       // Latitude column (for point data)
  longitude?: string;      // Longitude column (for point data)
  geometry?: string;       // Geometry column (for spatial data)
}
```

### Color Mapping

Define how data values map to colors:

```typescript
interface ColorMapping {
  type: 'continuous' | 'categorical' | 'custom';
  field: string;           // Data field to map
  
  // For continuous mapping
  stops?: [number, string][];
  interpolation?: 'linear' | 'exponential' | 'cubic-bezier';
  
  // For categorical mapping
  categories?: { [key: string]: string };
  defaultColor?: string;
  
  // For custom mapping
  expression?: string;     // MapLibre expression
}
```

### Advanced Services

```typescript
interface StylerAdvancedService {
  // Data analysis
  analyzeData(nodeId: NodeId): Promise<DataAnalysisResult>;
  validateData(nodeId: NodeId): Promise<ValidationResult>;
  generateDataProfile(nodeId: NodeId): Promise<DataProfile>;
  
  // Style generation
  generateAdvancedStyles(nodeId: NodeId, options: StyleOptions): Promise<MapLibreStyle>;
  optimizeStyles(nodeId: NodeId): Promise<OptimizationResult>;
  
  // Performance optimization
  optimizePerformance(nodeId: NodeId): Promise<PerformanceOptimization>;
  
  // Export capabilities
  exportAsMapLibreStyle(nodeId: NodeId): Promise<MapLibreStyle>;
  exportAsCSS(nodeId: NodeId): Promise<string>;
  exportAsGeoJSON(nodeId: NodeId): Promise<GeoJSON>;
  exportAsCSV(nodeId: NodeId): Promise<string>;
}
```

## API Reference

### Core Functions

#### `createStyler(data: CreateStylerData): Promise<StylerEntity>`

Creates a new Styler with the specified configuration.

**Parameters:**
- `data.name` (string): Styler name
- `data.description` (string, optional): Description
- `data.dataSource` (DataSourceConfig): Data source configuration
- `data.columnMapping` (ColumnMapping): Column mapping rules
- `data.colorMapping` (ColorMapping): Color mapping configuration
- `data.filterRules` (FilterRule[], optional): Initial filter rules

**Returns:** Promise<StylerEntity>

#### `updateStyler(nodeId: NodeId, data: UpdateStylerData): Promise<StylerEntity>`

Updates an existing Styler.

#### `deleteStyler(nodeId: NodeId): Promise<void>`

Deletes a Styler and cleans up its resources.

### Data Analysis API

#### `analyzeData(nodeId: NodeId): Promise<DataAnalysisResult>`

Performs comprehensive data analysis:

```typescript
interface DataAnalysisResult {
  rowCount: number;
  columnCount: number;
  columns: ColumnAnalysis[];
  dataQuality: DataQualityMetrics;
  recommendations: string[];
  spatialExtent?: SpatialExtent;
}

interface ColumnAnalysis {
  name: string;
  type: 'number' | 'string' | 'date' | 'boolean';
  uniqueCount: number;
  nullCount: number;
  distribution: ValueDistribution;
  statistics?: NumericStatistics;
}
```

#### `validateData(nodeId: NodeId): Promise<ValidationResult>`

Validates data quality and consistency:

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  qualityScore: number; // 0-100
  suggestions: string[];
}
```

### Style Generation API

#### `generateAdvancedStyles(nodeId: NodeId, options: StyleOptions): Promise<MapLibreStyle>`

Generates MapLibre styles from data:

```typescript
interface StyleOptions {
  colorScheme: 'sequential' | 'diverging' | 'categorical';
  colorPalette: string; // 'viridis', 'plasma', 'turbo', etc.
  classificationMethod: 'quantile' | 'equal' | 'natural' | 'standard';
  classCount: number;
  includeOutliers: boolean;
  customBreaks?: number[];
}
```

### Performance Optimization API

#### `optimizePerformance(nodeId: NodeId): Promise<PerformanceOptimization>`

Optimizes Styler for better performance:

```typescript
interface PerformanceOptimization {
  originalSize: number;
  optimizedSize: number;
  reductionPercent: number;
  optimizations: string[];
  estimatedLoadTime: number;
  memoryUsage: number;
}
```

### Export API

```typescript
// Export as MapLibre style
const style = await StylerAdvancedService.getInstance()
  .exportAsMapLibreStyle(nodeId);

// Export as CSS
const css = await StylerAdvancedService.getInstance()
  .exportAsCSS(nodeId);

// Export data as GeoJSON
const geojson = await StylerAdvancedService.getInstance()
  .exportAsGeoJSON(nodeId);
```

## Advanced Features

### Data Analysis

Comprehensive data analysis capabilities:

```typescript
interface DataProfile {
  summary: {
    totalRows: number;
    totalColumns: number;
    completeness: number; // 0-1
    uniqueness: number;   // 0-1
  };
  
  columns: {
    [columnName: string]: {
      type: DataType;
      distribution: Distribution;
      quality: QualityMetrics;
      recommendations: string[];
    };
  };
  
  spatial?: {
    bounds: [[number, number], [number, number]];
    geometryType: 'Point' | 'LineString' | 'Polygon';
    coordinateSystem: string;
  };
}
```

### Advanced Styling

Sophisticated styling with expressions:

```typescript
interface AdvancedColorMapping {
  // Data-driven styling
  expression: [
    'case',
    ['<', ['get', 'population'], 1000], '#fff5f0',
    ['<', ['get', 'population'], 5000], '#fee0d2',
    ['<', ['get', 'population'], 10000], '#fcbba1',
    '#a50f15'
  ];
  
  // Interactive styling
  hoverStyle?: StyleExpression;
  selectedStyle?: StyleExpression;
  
  // Conditional visibility
  visibility?: VisibilityExpression;
}
```

### Filter Engine

Advanced filtering with boolean logic:

```typescript
interface FilterRule {
  id: string;
  name: string;
  field: string;
  operator: FilterOperator;
  value: any;
  logicalOperator?: 'AND' | 'OR';
  nested?: FilterRule[];
}

type FilterOperator = 
  | '=' | '!=' | '>' | '<' | '>=' | '<='
  | 'contains' | 'startsWith' | 'endsWith'
  | 'in' | 'notIn' | 'between'
  | 'isNull' | 'isNotNull'
  | 'regex';
```

### Performance Monitoring

Real-time performance analytics:

```typescript
interface StylerAnalytics {
  usage: {
    viewCount: number;
    lastViewed: Timestamp;
    averageLoadTime: number;
    errorRate: number;
  };
  
  performance: {
    dataSize: number;
    renderTime: number;
    memoryUsage: number;
    cacheHitRate: number;
  };
  
  data: {
    quality: DataQualityMetrics;
    freshness: Timestamp;
    completeness: number;
    accuracy: number;
  };
}
```

## User Guide

### Creating a Styler

#### Step 1: Basic Information
- Enter Styler name and description
- Choose the purpose (visualization, analysis, presentation)

#### Step 2: Data Import
- Upload file or provide URL
- Select data format (CSV, Excel, JSON, GeoJSON)
- Configure import options (delimiter, encoding, headers)

#### Step 3: Column Mapping
- Map data columns to styling properties
- Identify key columns (ID, value, label, coordinates)
- Preview data structure

#### Step 4: Style Configuration
- Choose color scheme and palette
- Configure classification method and class count
- Set up size and shape mapping (if applicable)

#### Step 5: Filtering (Optional)
- Create filter rules for data subsets
- Combine filters with boolean logic
- Test filter results

#### Step 6: Preview and Validation
- Preview styled data on map
- Review data quality metrics
- Check performance recommendations

### Advanced Styling Techniques

#### Continuous Color Mapping

```typescript
const continuousMapping: ColorMapping = {
  type: 'continuous',
  field: 'temperature',
  stops: [
    [-10, '#313695'],  // Cold
    [0, '#74add1'],
    [10, '#abd9e9'],
    [20, '#e0f3f8'],
    [25, '#ffffcc'],
    [30, '#fee090'],
    [35, '#fdae61'],
    [40, '#f46d43'],   // Hot
  ],
  interpolation: 'linear',
};
```

#### Categorical Color Mapping

```typescript
const categoricalMapping: ColorMapping = {
  type: 'categorical',
  field: 'landuse',
  categories: {
    'residential': '#ffd89b',
    'commercial': '#19547b',
    'industrial': '#472e32',
    'park': '#86c232',
    'water': '#4dabf7',
  },
  defaultColor: '#999999',
};
```

#### Custom Expression Mapping

```typescript
const customMapping: ColorMapping = {
  type: 'custom',
  field: 'population_density',
  expression: [
    'interpolate',
    ['linear'],
    ['/', ['get', 'population'], ['get', 'area']],
    0, '#fff5f0',
    100, '#fee0d2',
    1000, '#fc9272',
    5000, '#de2d26',
  ],
};
```

### Data Quality Management

#### Quality Metrics

- **Completeness**: Percentage of non-null values
- **Uniqueness**: Ratio of unique to total values
- **Validity**: Percentage of values meeting format requirements
- **Accuracy**: Estimated data accuracy based on validation rules
- **Consistency**: Internal consistency across related fields

#### Quality Improvements

1. **Data Cleaning**: Automatic detection and suggestion of data issues
2. **Normalization**: Standardize formats and values
3. **Validation Rules**: Custom validation for domain-specific data
4. **Outlier Detection**: Identify and handle statistical outliers

### Performance Optimization

#### Automatic Optimizations

1. **Data Simplification**: Reduce precision for display purposes
2. **Spatial Indexing**: Create spatial indexes for geographic data
3. **Caching**: Intelligent caching of processed data
4. **Lazy Loading**: Load data progressively based on zoom level

#### Manual Optimizations

```typescript
const optimizationSettings: OptimizationSettings = {
  enableCaching: true,
  maxFeatureCount: 10000,
  simplificationTolerance: 0.001,
  enableClustering: true,
  clusterRadius: 50,
  enableFiltering: true,
  precomputeStyles: true,
};
```

## Configuration

### Plugin Configuration

```typescript
export const STYLEMAP_CONFIG = {
  name: 'styler-plugin',
  version: '1.0.0',
  description: 'Advanced Data Styling and Visualization',
  capabilities: {
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: true,
    supportsChildren: false,
    supportedFormats: ['csv', 'excel', 'json', 'geojson'],
  },
  limits: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxRowCount: 100000,
    maxColumnCount: 100,
  },
};
```

### Performance Settings

```typescript
interface PerformanceSettings {
  renderingEngine: 'webgl' | 'canvas';
  maxSimultaneousRequests: number;
  cacheSize: number;
  enableWebWorkers: boolean;
  tileLoadTimeout: number;
}
```

## Examples

## 依存管理とインポート規約（重要）
共通方針は packages/plugins/CONTRIBUTING.md を参照。要点:
- peerDependencies: react, react-dom, @mui/material, @mui/icons-material, @emotion/react, @emotion/styled, dexie, （必要時）react-i18next, i18next
- dependencies: @hierarchidb/util、必要に応じて @hierarchidb/features/*（例: @hierarchidb/table-metadata）
- devDependencies: typescript/tsup/vitest/@testing-library/*/@types/*
- import は公開API、型は `import type`、重い処理は dynamic import。
- tsup external は共通設定で外部化済み。
### Population Density Visualization

```typescript
const populationStyler = await createStyler({
  name: 'Population Density',
  description: 'US states by population density',
  dataSource: {
    type: 'csv',
    url: 'https://example.com/us-states-population.csv',
    options: {
      headers: true,
      delimiter: ',',
    },
  },
  columnMapping: {
    id: 'state_code',
    value: 'density',
    label: 'state_name',
  },
  colorMapping: {
    type: 'continuous',
    field: 'density',
    stops: [
      [0, '#f7fbff'],
      [50, '#deebf7'],
      [100, '#c6dbef'],
      [200, '#9ecae1'],
      [500, '#6baed6'],
      [1000, '#4292c6'],
      [2000, '#2171b5'],
      [5000, '#084594'],
    ],
  },
  filterRules: [
    {
      id: 'min-population',
      name: 'Minimum Population',
      field: 'population',
      operator: '>',
      value: 100000,
    },
  ],
});
```

### Economic Data Visualization

```typescript
const economicStyler = await createStyler({
  name: 'Economic Indicators',
  description: 'Countries by GDP per capita',
  dataSource: {
    type: 'geojson',
    url: 'https://example.com/world-countries-gdp.geojson',
  },
  columnMapping: {
    id: 'iso_code',
    value: 'gdp_per_capita',
    label: 'country_name',
    category: 'region',
  },
  colorMapping: {
    type: 'continuous',
    field: 'gdp_per_capita',
    stops: [
      [0, '#fff5eb'],
      [1000, '#fee6ce'],
      [5000, '#fdd0a2'],
      [10000, '#fdae6b'],
      [20000, '#fd8d3c'],
      [50000, '#f16913'],
      [80000, '#d94801'],
      [100000, '#8c2d04'],
    ],
    interpolation: 'exponential',
  },
  sizeMapping: {
    type: 'continuous',
    field: 'population',
    range: [5, 25],
  },
});
```

### Real-time Data Integration

```typescript
import React, { useEffect, useState } from 'react';
import { StylerAdvancedService } from '@hierarchidb/plugin-styler-plugin';

const RealTimeStyler: React.FC<{ nodeId: NodeId }> = ({ nodeId }) => {
  const [analysis, setAnalysis] = useState<DataAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const service = StylerAdvancedService.getInstance();
        
        // Analyze current data
        const dataAnalysis = await service.analyzeData(nodeId);
        setAnalysis(dataAnalysis);
        
        // Validate data quality
        const validation = await service.validateData(nodeId);
        if (!validation.isValid) {
          console.warn('Data quality issues:', validation.errors);
        }
        
        // Optimize performance if needed
        if (dataAnalysis.rowCount > 10000) {
          await service.optimizePerformance(nodeId);
        }
        
      } catch (error) {
        console.error('Error loading Styler data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    
    // Set up periodic data refresh
    const interval = setInterval(loadData, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [nodeId]);

  if (isLoading) {
    return <div>Loading data analysis...</div>;
  }

  return (
    <div>
      <h2>Styler Analytics</h2>
      {analysis && (
        <div>
          <h3>Data Summary</h3>
          <p>Rows: {analysis.rowCount.toLocaleString()}</p>
          <p>Columns: {analysis.columnCount}</p>
          <p>Quality Score: {analysis.dataQuality.overall * 100}%</p>
          
          <h3>Recommendations</h3>
          <ul>
            {analysis.recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

## License

MIT License - see LICENSE file for details.

## Spreadsheet プラグインとの連携

Styler は spreadsheet-plugin を拡張する設計になっており、以下のコンポーネントを再利用します。

- `createSpreadsheetCSVApi()`・`SpreadsheetCSVApiAdapter` を経由して CSV/Excel 等の取り込み処理を委譲します。
- `SpreadsheetTabularDriver`／`SpreadsheetStorePort` が提供するチャンク保存ロジックを利用し、Styler 側ではスタイル設定に専念します。
- Spreadsheet のエンティティ／ワーキングコピー管理（3×2 ライフサイクル）はそのまま継承しており、Styler 固有の処理は `StylerDataService` と `StylerEntityHandler` に追加する形です。

この構造により、データの読み込み・保存は spreadsheet-plugin に一任し、Styler はスタイル生成や可視化に関する独自機能だけを実装しています。
