# Data Migration

## Overview

This document covers data migration strategies for HierarchiDB, including import/export functionality, data transformation, and cross-system migration approaches.

## Prerequisites

- Understanding of IndexedDB structure
- Knowledge of data formats (JSON, CSV)
- Backup procedures familiarity

## When to Read This Document

- When migrating data between environments
- When implementing import/export features
- When transforming data structures

## Data Export

### Full Database Export

```typescript
// export-database.ts
import Dexie from 'dexie';
import { CoreDB } from '@hierarchidb/worker';

export async function exportFullDatabase(): Promise<string> {
  const db = new CoreDB();
  
  const exportData = {
    version: '2.0.0',
    timestamp: Date.now(),
    trees: await db.trees.toArray(),
    nodes: await db.nodes.toArray(),
    rootStates: await db.rootStates.toArray(),
    plugins: {}
  };
  
  // Export plugin data
  for (const plugin of registeredPlugins) {
    const table = db.table(plugin.entityStore);
    exportData.plugins[plugin.nodeType] = await table.toArray();
  }
  
  return JSON.stringify(exportData, null, 2);
}
```

### Selective Export

```typescript
// Selective tree export
export async function exportTree(treeId: TreeId): Promise<ExportData> {
  const nodes = await db.nodes
    .where('treeId')
    .equals(treeId)
    .toArray();
  
  const tree = await db.trees
    .where('treeId')
    .equals(treeId)
    .first();
  
  // Get related entities
  const entities = await gatherEntities(nodes);
  
  return {
    tree,
    nodes,
    entities,
    metadata: {
      exportDate: new Date().toISOString(),
      nodeCount: nodes.length,
      entityCount: entities.length
    }
  };
}
```

### Export Formats

#### JSON Format

```typescript
interface ExportFormat {
  version: string;
  timestamp: number;
  data: {
    trees: TreeEntity[];
    nodes: TreeNodeEntity[];
    entities: Record<string, unknown[]>;
  };
  metadata: {
    nodeCount: number;
    entityCount: number;
    checksum: string;
  };
}
```

#### CSV Export

```typescript
export function exportToCSV(nodes: TreeNodeEntity[]): string {
  const headers = ['id', 'parentNodeId', 'name', 'type', 'createdAt'];
  const rows = nodes.map(node => [
    node.treeNodeId,
    node.parentNodeId,
    node.name,
    node.nodeType,
    new Date(node.createdAt).toISOString()
  ]);
  
  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
}
```

## Data Import

### Import Validation

```typescript
// import-validator.ts
export class ImportValidator {
  async validate(data: unknown): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Check structure
    if (!this.isValidStructure(data)) {
      errors.push({
        code: 'INVALID_STRUCTURE',
        message: 'Import data structure is invalid'
      });
    }
    
    // Check version compatibility
    if (!this.isCompatibleVersion(data.version)) {
      errors.push({
        code: 'INCOMPATIBLE_VERSION',
        message: `Version ${data.version} is not compatible`
      });
    }
    
    // Validate IDs
    const idErrors = await this.validateIds(data);
    errors.push(...idErrors);
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private validateIds(data: ExportData): ValidationError[] {
    const errors: ValidationError[] = [];
    const idSet = new Set<string>();
    
    for (const node of data.nodes) {
      if (idSet.has(node.treeNodeId)) {
        errors.push({
          code: 'DUPLICATE_ID',
          message: `Duplicate ID: ${node.treeNodeId}`
        });
      }
      idSet.add(node.treeNodeId);
    }
    
    return errors;
  }
}
```

### Import Process

```typescript
// import-manager.ts
export class ImportManager {
  async importData(
    jsonData: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const data = JSON.parse(jsonData);
    
    // Validate
    const validation = await this.validator.validate(data);
    if (!validation.valid) {
      throw new ImportError(validation.errors);
    }
    
    // Transform if needed
    const transformed = await this.transform(data, options);
    
    // Begin transaction
    const transaction = await db.transaction('rw', 
      db.trees, 
      db.nodes, 
      ...pluginTables,
      async () => {
        // Import trees
        if (options.clearExisting) {
          await db.trees.clear();
        }
        await db.trees.bulkAdd(transformed.trees);
        
        // Import nodes
        await db.nodes.bulkAdd(transformed.nodes);
        
        // Import plugin data
        for (const [type, entities] of Object.entries(transformed.entities)) {
          const table = db.table(pluginStores[type]);
          await table.bulkAdd(entities);
        }
      }
    );
    
    return {
      success: true,
      imported: {
        trees: transformed.trees.length,
        nodes: transformed.nodes.length,
        entities: Object.values(transformed.entities)
          .reduce((sum, arr) => sum + arr.length, 0)
      }
    };
  }
}
```

## Data Transformation

### Schema Transformation

```typescript
// transform-schema.ts
export class SchemaTransformer {
  transform(source: V1Schema, target: V2Schema): TransformResult {
    const transformed = {
      trees: this.transformTrees(source.trees),
      nodes: this.transformNodes(source.nodes),
      entities: this.transformEntities(source.entities)
    };
    
    return {
      data: transformed,
      mappings: this.generateMappings(source, transformed)
    };
  }
  
  private transformNodes(nodes: V1Node[]): V2Node[] {
    return nodes.map(node => ({
      treeNodeId: node.id as NodeId,
      parentNodeId: node.parentId as NodeId,
      treeId: node.treeId as TreeId,
      name: node.name,
      nodeType: this.mapNodeType(node.type),
      createdAt: node.createdAt,
      updatedAt: node.updatedAt || node.createdAt,
      version: 1,
      removedAt: null,
      originalParentNodeId: null,
      references: []
    }));
  }
  
  private mapNodeType(v1Type: string): string {
    const typeMap = {
      'folder': 'folder',
      'document': 'file',
      'root': 'Root',
      'trash': 'Trash'
    };
    
    return typeMap[v1Type] || v1Type;
  }
}
```

### Data Cleaning

```typescript
// data-cleaner.ts
export class DataCleaner {
  clean(data: ImportData): CleanedData {
    return {
      trees: this.cleanTrees(data.trees),
      nodes: this.cleanNodes(data.nodes),
      entities: this.cleanEntities(data.entities)
    };
  }
  
  private cleanNodes(nodes: TreeNodeEntity[]): TreeNodeEntity[] {
    return nodes
      .filter(node => this.isValidNode(node))
      .map(node => ({
        ...node,
        name: this.sanitizeName(node.name),
        createdAt: this.normalizeTimestamp(node.createdAt),
        updatedAt: this.normalizeTimestamp(node.updatedAt)
      }));
  }
  
  private sanitizeName(name: string): string {
    return name
      .trim()
      .replace(/[<>:"\/\\|?*]/g, '_')
      .substring(0, 255);
  }
  
  private normalizeTimestamp(ts: number | string): number {
    if (typeof ts === 'number') return ts;
    return new Date(ts).getTime();
  }
}
```

## Bulk Operations

### Batch Import

```typescript
// batch-import.ts
export class BatchImporter {
  async importBatch(
    items: ImportItem[],
    batchSize: number = 100
  ): Promise<BatchResult> {
    const results: BatchResult = {
      successful: 0,
      failed: 0,
      errors: []
    };
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        await this.processBatch(batch);
        results.successful += batch.length;
        
        // Progress callback
        if (this.onProgress) {
          this.onProgress({
            processed: i + batch.length,
            total: items.length,
            percentage: ((i + batch.length) / items.length) * 100
          });
        }
      } catch (error) {
        results.failed += batch.length;
        results.errors.push({
          batch: i / batchSize,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  private async processBatch(items: ImportItem[]): Promise<void> {
    await db.transaction('rw', db.nodes, async () => {
      for (const item of items) {
        await db.nodes.add(item);
      }
    });
  }
}
```

### Stream Processing

```typescript
// stream-processor.ts
export class StreamProcessor {
  async processStream(
    stream: ReadableStream,
    processor: DataProcessor
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            const item = JSON.parse(line);
            await processor.process(item);
          }
        }
      }
      
      // Process remaining buffer
      if (buffer.trim()) {
        const item = JSON.parse(buffer);
        await processor.process(item);
      }
    } finally {
      reader.releaseLock();
    }
  }
}
```

## Migration Tools

### CLI Migration Tool

```typescript
// cli-migrate.ts
#!/usr/bin/env node

import { program } from 'commander';
import { MigrationManager } from './migration-manager';

program
  .version('1.0.0')
  .description('HierarchiDB Migration Tool');

program
  .command('export <database>')
  .description('Export database to JSON')
  .option('-o, --output <file>', 'Output file', 'export.json')
  .action(async (database, options) => {
    const manager = new MigrationManager();
    const data = await manager.export(database);
    await writeFile(options.output, data);
    console.log(`Exported to ${options.output}`);
  });

program
  .command('import <file>')
  .description('Import data from JSON')
  .option('-d, --database <name>', 'Target database')
  .option('--clear', 'Clear existing data')
  .action(async (file, options) => {
    const manager = new MigrationManager();
    const data = await readFile(file);
    const result = await manager.import(data, options);
    console.log(`Imported: ${result.imported.nodes} nodes`);
  });

program.parse(process.argv);
```

### Web-based Migration UI

```typescript
// MigrationUI.tsx
export function MigrationUI() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  
  const handleImport = async () => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target?.result as string;
      const importer = new ImportManager();
      
      importer.onProgress = (p) => setProgress(p.percentage);
      
      try {
        const result = await importer.importData(data);
        setResult(result);
      } catch (error) {
        console.error('Import failed:', error);
      }
    };
    
    reader.readAsText(file);
  };
  
  return (
    <Box>
      <input
        type="file"
        accept=".json"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <Button onClick={handleImport}>Import</Button>
      {progress > 0 && <LinearProgress value={progress} />}
      {result && (
        <Alert severity="success">
          Imported {result.imported.nodes} nodes successfully
        </Alert>
      )}
    </Box>
  );
}
```

## Error Recovery

### Transaction Rollback

```typescript
// transaction-manager.ts
export class TransactionManager {
  async executeWithRollback<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    const backup = await this.createBackup();
    
    try {
      const result = await operation();
      await this.commitTransaction();
      return result;
    } catch (error) {
      await this.rollback(backup);
      throw error;
    } finally {
      await this.cleanupBackup(backup);
    }
  }
  
  private async createBackup(): Promise<Backup> {
    const data = await exportFullDatabase();
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      data
    };
  }
  
  private async rollback(backup: Backup): Promise<void> {
    await db.delete();
    await db.open();
    await importData(backup.data);
  }
}
```

## Performance Optimization

### Chunked Processing

```typescript
// chunked-processor.ts
export async function processInChunks<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  chunkSize: number = 50
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    
    // Process chunk in parallel
    await Promise.all(chunk.map(processor));
    
    // Allow UI to update
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

## Related Documentation

- [Version Migration](./01-version-migration.md)
- [Database Architecture](../03-DATABASE/01-database-architecture.md)
- [Backup & Recovery](../05-QUALITY/03-monitoring.md)