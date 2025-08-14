# StyleMap Plugin for hierarchidb

A powerful plugin for mapping CSV/TSV data to MapLibre GL style properties with advanced filtering and color mapping capabilities.

## Features

### 📊 Data Processing
- **Multiple File Formats**: CSV, TSV, Excel (.xlsx, .xls)
- **Intelligent Type Detection**: Automatic detection of numeric, text, and date columns
- **Large Dataset Support**: Handle up to 1M rows and 1K columns
- **Streaming Import**: Memory-efficient processing of large files

### 🎨 Color Mapping
- **Multiple Algorithms**: Linear, logarithmic, quantile, and categorical mapping
- **Color Space Support**: RGB and HSV interpolation
- **Preset Collections**: Built-in color schemes (heat, traffic, ocean, forest, sunset)
- **Custom Configurations**: Fine-grained control over color parameters

### 🔧 Advanced Filtering
- **Pattern Matching**: Support for exact matches and regular expressions
- **Include/Exclude Rules**: Flexible data inclusion and exclusion
- **Template Rules**: Pre-built filters for common data patterns
- **Real-time Preview**: See filter results instantly

### ⚡ Performance Optimization
- **Intelligent Caching**: SHA3-based caching with automatic invalidation
- **Normalized Database Design**: Optimized for large datasets
- **Background Processing**: Non-blocking operations
- **Memory Management**: Efficient resource utilization

### 🔄 Working Copy System
- **Safe Editing**: Edit configurations without affecting original data
- **Draft Support**: Create new configurations from scratch
- **Commit/Discard**: Full transaction support
- **Change Tracking**: Automatic dirty state detection

## Installation

```bash
# Install dependencies
npm install @hierarchidb/plugin-stylemap

# Or with pnpm
pnpm add @hierarchidb/plugin-stylemap
```

## Quick Start

### 1. Register the Plugin

```typescript
import { stylemapPlugin } from '@hierarchidb/plugin-stylemap';
import { PluginRegistry } from '@hierarchidb/core';

// Register plugin
PluginRegistry.register(stylemapPlugin);
```

### 2. Create a StyleMap

```typescript
import { StyleMapEntityHandler } from '@hierarchidb/plugin-stylemap';

const handler = new StyleMapEntityHandler();

// Create new StyleMap
const styleMap = await handler.createEntity('node-id', {
  filename: 'population-data.csv',
  keyColumn: 'country',
  valueColumn: 'population'
});
```

### 3. Import Data

```typescript
// Import CSV file
const file = new File([csvContent], 'data.csv', { type: 'text/csv' });
const result = await handler.importTableData('node-id', file, {
  keyColumn: 'country',
  valueColumn: 'population'
});

console.log(`Imported ${result.rowCount} rows`);
```

### 4. Configure Color Mapping

```typescript
import { createStyleMapConfig } from '@hierarchidb/plugin-stylemap';

const config = createStyleMapConfig({
  algorithm: 'linear',
  colorSpace: 'hsv',
  targetProperty: 'fill-color',
  mapping: {
    min: 0,
    max: 1000000,
    hueStart: 0.0,    // Red
    hueEnd: 0.67,     // Blue
    saturation: 0.8,
    brightness: 0.9
  }
});

// Update StyleMap with configuration
await handler.updateEntity('node-id', { styleMapConfig: config });
```

### 5. Generate Style Mapping

```typescript
// Generate color mapping
const mapping = await handler.generateColorMapping('node-id', config);

console.log(`Generated ${mapping.properties.length} style properties`);
// Output: [ { keyValue: 'USA', styleValue: '#ff0000' }, ... ]
```

## API Reference

### Core Classes

#### StyleMapEntityHandler

Main handler for StyleMap operations:

```typescript
// CRUD operations
await handler.createEntity(nodeId, data);
await handler.getEntity(nodeId);
await handler.updateEntity(nodeId, updates);
await handler.deleteEntity(nodeId);

// Working copy operations
await handler.createWorkingCopy(nodeId);
await handler.commitWorkingCopy(nodeId);
await handler.discardWorkingCopy(nodeId);

// Data operations
await handler.importTableData(nodeId, file, options);
await handler.queryTableData(nodeId, queryOptions);
await handler.applyFilterRules(nodeId, rules);
await handler.generateColorMapping(nodeId, config);
```

#### StyleMapDatabase

Database operations:

```typescript
const db = StyleMapDatabase.getInstance();

// Entity operations
await db.saveEntity(entity);
await db.getEntity(nodeId);
await db.updateEntity(nodeId, updates);
await db.deleteEntity(nodeId);

// Table operations
await db.saveTableMetadata(metadata);
await db.batchInsertRows(rows);
await db.queryTableRows(tableId, options);

// Cache operations
await db.saveCache(entry);
await db.getCache(cacheKey);
await db.cleanupExpiredCache();
```

### Configuration Types

#### StyleMapConfig

```typescript
interface StyleMapConfig {
  algorithm: 'linear' | 'logarithmic' | 'quantile' | 'categorical';
  colorSpace: 'rgb' | 'hsv';
  mapping: {
    min: number;
    max: number;
    hueStart: number;    // 0-1
    hueEnd: number;      // 0-1
    saturation: number;  // 0-1
    brightness: number;  // 0-1
  };
  targetProperty: MapLibreStyleProperty;
}
```

#### FilterRule

```typescript
interface FilterRule {
  id: string;
  action: 'Include' | 'Exclude' | 'IncludePattern' | 'ExcludePattern';
  keyColumn: string;
  matchValue: string;
  enabled?: boolean;
}
```

## Examples

### Basic CSV Processing

```typescript
import { StyleMapEntityHandler, createFilterRule } from '@hierarchidb/plugin-stylemap';

const handler = new StyleMapEntityHandler();

// Create StyleMap
const nodeId = 'my-stylemap';
await handler.createEntity(nodeId, {
  filename: 'world-population.csv'
});

// Import CSV file
const file = await fetch('/data/world-population.csv').then(r => r.blob());
await handler.importTableData(nodeId, file as File);

// Add filter to exclude regional aggregates
const filter = createFilterRule({
  action: 'ExcludePattern',
  keyColumn: 'country_code',
  matchValue: '^(WLD|OECD|EU)$'
});

await handler.updateEntity(nodeId, {
  keyColumn: 'country_code',
  valueColumn: 'population',
  filterRules: [filter]
});
```

### Advanced Color Mapping

```typescript
import { applyColorPreset, COLOR_MAPPING_PRESETS } from '@hierarchidb/plugin-stylemap';

// Start with a preset
let config = createStyleMapConfig({
  algorithm: 'logarithmic',
  targetProperty: 'circle-radius'
});

// Apply color preset
config = applyColorPreset(config, 'heat');

// Generate mapping
const result = await handler.generateColorMapping(nodeId, config);

// Use in MapLibre GL
const maplibreStyle = {
  'id': 'population-circles',
  'type': 'circle',
  'paint': {
    'circle-color': {
      'type': 'categorical',
      'property': 'country_code',
      'stops': result.properties.map(p => [p.keyValue, p.styleValue])
    }
  }
};
```

### Working with Large Datasets

```typescript
// Stream large datasets efficiently
const optimizer = new StyleMapDatabaseOptimizer(db);

// Configure for large datasets
await optimizer.optimizeSchema();

// Stream rows for processing
for await (const rowBatch of optimizer.streamTableRows(tableId, 5000)) {
  // Process batch of 5000 rows
  console.log(`Processing ${rowBatch.length} rows`);
}

// Monitor performance
const metrics = optimizer.getMetrics();
console.log(`Average query time: ${metrics.avgQueryTime}ms`);
console.log(`Cache hit rate: ${metrics.cacheHitRate}%`);
```

## Performance Considerations

### File Size Limits
- **Maximum file size**: 50MB
- **Maximum rows**: 1,000,000
- **Maximum columns**: 1,000

### Memory Usage
- **Estimated memory per row**: ~256 bytes
- **Cache limit**: 100MB (configurable)
- **Working copy TTL**: 24 hours

### Optimization Tips

1. **Use appropriate algorithms**: Linear for uniform distributions, logarithmic for exponential data
2. **Apply filters early**: Reduce dataset size before processing
3. **Monitor cache hit rates**: High cache hit rates improve performance
4. **Use streaming for large datasets**: Process data in batches

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- **Documentation**: [Full API Documentation](docs/)
- **Issues**: [GitHub Issues](https://github.com/hierarchidb/hierarchidb/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hierarchidb/hierarchidb/discussions)