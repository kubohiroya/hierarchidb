# @hierarchidb/csv-storage

Hybrid storage system for large CSV files with chunking, compression, and caching. Optimized for browser-based processing of CSV files ranging from small to hundreds of MB.

## Features

- 🚀 **Fast chunked storage** - Split large CSV files into compressed chunks for efficient storage
- 🗜️ **Automatic compression** - Uses pako for gzip compression of chunks
- 🔍 **Rule-based filtering** - Powerful filter engine with multiple operators
- 💾 **Smart caching** - Cache filter results for repeated queries
- 📊 **Column indexing** - Build indexes for fast value lookups
- 🌊 **Streaming API** - Process large files without loading everything into memory
- 📈 **Statistics** - Automatic column type detection and statistics

## Installation

```bash
pnpm add @hierarchidb/csv-storage
```

## Basic Usage

```typescript
import { CSVStorage } from '@hierarchidb/csv-storage';

// Create storage instance
const storage = new CSVStorage();

// Save CSV content
const metadata = await storage.save(
  'node-123' as NodeId,
  csvContent,
  {
    delimiter: ',',
    hasHeader: true,
    buildIndexColumns: ['id', 'name'] // Optional: pre-build indexes
  }
);

// Query with filters
const result = await storage.query(
  'node-123' as NodeId,
  [
    { column: 'status', operator: 'equals', value: 'active' },
    { column: 'amount', operator: 'greater_than', value: 100 }
  ],
  {
    limit: 100,
    offset: 0,
    useCache: true
  }
);

console.log(`Found ${result.totalMatches} matching rows`);
console.log(`Query time: ${result.queryTime}ms`);
console.log(`From cache: ${result.fromCache}`);
```

## Advanced Features

### Streaming Large Files

```typescript
// Stream chunks for progressive processing
for await (const chunk of storage.streamChunks('node-123' as NodeId)) {
  console.log(`Processing rows ${chunk.startIndex} to ${chunk.endIndex}`);
  console.log(`Progress: ${chunk.progress}%`);
  
  // Process chunk.rows
  for (const row of chunk.rows) {
    // Your processing logic
  }
}
```

### Building and Using Indexes

```typescript
// Build index for fast lookups
const index = await storage.buildIndex('node-123' as NodeId, 'category');

// Get unique values
const uniqueValues = await storage.getUniqueValues('node-123' as NodeId, 'category');

// Get value distribution
const distribution = await storage.getValueDistribution(
  'node-123' as NodeId,
  'category',
  10 // Top 10 values
);
```

### Filter Operators

The filter engine supports the following operators:

- `equals` / `not_equals` - Exact match
- `contains` / `not_contains` - Substring match
- `starts_with` / `ends_with` - Prefix/suffix match
- `regex` - Regular expression match
- `greater_than` / `less_than` - Numeric comparison
- `greater_than_or_equal` / `less_than_or_equal` - Inclusive comparison
- `is_null` / `is_not_null` - Null checks

### Cache Management

```typescript
// Clean up expired cache entries
const deletedCount = await storage.cleanupCache();

// Get storage statistics
const stats = await storage.getStats();
console.log(`Total chunks: ${stats.totalChunks}`);
console.log(`Cache entries: ${stats.totalCacheEntries}`);
console.log(`Estimated size: ${stats.estimatedSize} bytes`);
```

## Performance Characteristics

| File Size | Save Time | Query Time (no cache) | Query Time (cached) |
|-----------|-----------|----------------------|-------------------|
| 1 MB      | ~100ms    | ~50ms               | ~5ms              |
| 10 MB     | ~500ms    | ~200ms              | ~10ms             |
| 100 MB    | ~3s       | ~1s                 | ~20ms             |
| 500 MB    | ~10s      | ~5s                 | ~50ms             |

*Times are approximate and depend on hardware and browser*

## Architecture

The package uses a hybrid approach:

1. **Chunked Storage**: Large CSV files are split into chunks (default 100K rows)
2. **Compression**: Each chunk is compressed using pako (gzip)
3. **Indexing**: Frequently queried columns can be indexed for fast lookups
4. **Caching**: Filter results are cached with TTL for repeated queries
5. **Streaming**: Support for progressive processing without loading entire file

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires IndexedDB and Web Crypto API support.

## License

MIT