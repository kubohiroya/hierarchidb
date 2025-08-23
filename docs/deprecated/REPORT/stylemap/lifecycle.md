# StyleMap Plugin Lifecycle Management

This document describes the lifecycle management of StyleMap entities, table metadata, and the data processing pipeline within the HierarchiDB plugin system.

## Entity Lifecycle Overview

The StyleMap Plugin implements sophisticated lifecycle management across multiple entity types:

```
StyleMap Entity Lifecycle
├── Creation Lifecycle
│   ├── Node Creation → Entity Creation → Table Association
│   └── Working Copy → Validation → Commit
├── Table Metadata Lifecycle  
│   ├── Import → Parse → Analyze → Store
│   └── Reference Counting → Sharing → Cleanup
├── Style Generation Lifecycle
│   ├── Configuration → Processing → Caching
│   └── Invalidation → Regeneration → Updates
└── Deletion Lifecycle
    ├── Reference Removal → Cleanup Check
    └── Cascade Deletion → Resource Cleanup
```

## StyleMap Entity Lifecycle

### Creation Phase

**1. Node Creation**
```typescript
// TreeNode creation triggers entity creation
const nodeCreation: NodeLifecycleHooks = {
  beforeCreate: async (parentId: NodeId, nodeData: Partial<StyleMapEntity>) => {
    // Validate required data
    if (!nodeData.name) {
      throw new Error('StyleMap name is required');
    }
    
    // Check file format if provided
    if (nodeData.filename) {
      const supportedFormats = /\.(csv|tsv|xlsx|xls)$/i;
      if (!supportedFormats.test(nodeData.filename)) {
        throw new Error('Unsupported file format');
      }
    }
  },
  
  afterCreate: async (node: TreeNode, context: NodeContext) => {
    // Create corresponding StyleMapEntity
    const handler = context.getEntityHandler<StyleMapEntity>('stylemap');
    await handler.createEntity(node.id, {
      name: node.name,
      description: node.description,
    });
  }
};
```

**2. Entity Creation Process**
```typescript
class StyleMapEntityHandler extends PeerEntityHandler<StyleMapEntity> {
  async createEntity(nodeId: NodeId, data?: Partial<StyleMapEntity>): Promise<StyleMapEntity> {
    // Generate unique entity ID
    const entityId = crypto.randomUUID() as EntityId;
    
    // Create entity with defaults
    const entity: StyleMapEntity = {
      id: entityId,
      nodeId,
      name: data?.name || 'Untitled StyleMap',
      description: data?.description,
      filterRules: [],
      selectedKeyColumn: '',
      selectedValueColumns: [],
      keyValueMappings: [],
      styleMapConfig: this.getDefaultStyleConfig(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    
    // Store in database
    await this.table.add(entity);
    
    // Trigger lifecycle events
    await this.triggerAfterCreate(entity);
    
    return entity;
  }
}
```

### Update Phase

**Working Copy Pattern Implementation**
```typescript
interface WorkingCopyLifecycle {
  // Create working copy for editing
  createWorkingCopy(entityId: EntityId): Promise<StyleMapWorkingCopy>;
  
  // Update working copy
  updateWorkingCopy(workingCopyId: string, changes: Partial<StyleMapEntity>): Promise<void>;
  
  // Commit changes to main entity
  commitWorkingCopy(workingCopyId: string): Promise<StyleMapEntity>;
  
  // Discard working copy
  discardWorkingCopy(workingCopyId: string): Promise<void>;
}

class StyleMapWorkingCopyManager implements WorkingCopyLifecycle {
  async createWorkingCopy(entityId: EntityId): Promise<StyleMapWorkingCopy> {
    const originalEntity = await this.entityHandler.getEntity(entityId);
    if (!originalEntity) {
      throw new Error('Entity not found');
    }
    
    const workingCopyId = crypto.randomUUID();
    const workingCopy: StyleMapWorkingCopy = {
      ...originalEntity,
      workingCopyId,
      workingCopyOf: entityId,
      copiedAt: Date.now(),
      isDirty: false,
    };
    
    await this.workingCopyTable.add(workingCopy);
    return workingCopy;
  }
  
  async commitWorkingCopy(workingCopyId: string): Promise<StyleMapEntity> {
    const workingCopy = await this.getWorkingCopy(workingCopyId);
    if (!workingCopy) {
      throw new Error('Working copy not found');
    }
    
    // Update main entity
    const updatedEntity: StyleMapEntity = {
      ...workingCopy,
      updatedAt: Date.now(),
      version: workingCopy.version + 1,
    };
    
    // Remove working copy properties
    delete (updatedEntity as any).workingCopyId;
    delete (updatedEntity as any).workingCopyOf;
    delete (updatedEntity as any).copiedAt;
    delete (updatedEntity as any).isDirty;
    
    // Atomic update
    await this.db.transaction('rw', [this.entityTable, this.workingCopyTable], async () => {
      await this.entityTable.put(updatedEntity);
      await this.workingCopyTable.delete(workingCopyId);
    });
    
    return updatedEntity;
  }
}
```

### Deletion Phase

**Cascade Deletion with Reference Management**
```typescript
const deletionLifecycle: NodeLifecycleHooks = {
  beforeDelete: async (node: TreeNode, context: NodeContext) => {
    const handler = context.getEntityHandler<StyleMapEntity>('stylemap');
    const entity = await handler.getEntity(node.id);
    
    if (entity?.tableMetadataId) {
      // Remove reference to shared table
      const tableManager = new TableMetadataManager();
      await tableManager.removeReference(
        entity.tableMetadataId as EntityId, 
        node.id
      );
    }
  },
  
  afterDelete: async (node: TreeNode, context: NodeContext) => {
    // Clean up any remaining working copies
    await this.cleanupWorkingCopies(node.id);
    
    // Clean up cached styles
    await this.cleanupStyleCache(node.id);
    
    // Log deletion for audit
    await this.logEntityDeletion(node.id);
  }
};
```

## Table Metadata Lifecycle

### Import and Creation

**Table Import Process**
```typescript
class TableImportLifecycle {
  async importTable(
    file: File, 
    nodeId: NodeId
  ): Promise<TableMetadataEntity> {
    // 1. Content processing
    const content = await this.readFileContent(file);
    const contentHash = await this.generateContentHash(content);
    
    // 2. Deduplication check
    const existingTable = await this.findByContentHash(contentHash);
    if (existingTable) {
      await this.addReference(existingTable.id, nodeId);
      return existingTable;
    }
    
    // 3. Parse and analyze
    const parsedData = await this.parseCSV(content);
    const columnStats = await this.analyzeColumns(parsedData);
    
    // 4. Create table metadata
    const tableMetadata: TableMetadataEntity = {
      id: crypto.randomUUID() as EntityId,
      filename: file.name,
      contentHash,
      columns: parsedData.headers,
      tableRows: parsedData.rows,
      fileSizeBytes: file.size,
      totalRows: parsedData.rows.length,
      columnStats,
      referenceCount: 1,
      nodeIds: [nodeId],
      lastAccessedAt: Date.now(),
      importedAt: Date.now(),
      version: 1,
    };
    
    // 5. Store in database
    await this.tableMetadataTable.add(tableMetadata);
    
    return tableMetadata;
  }
}
```

### Reference Counting Management

**Reference Lifecycle**
```typescript
class ReferenceCountingManager {
  async addReference(tableId: EntityId, nodeId: NodeId): Promise<void> {
    await this.db.transaction('rw', this.tableMetadataTable, async () => {
      const table = await this.tableMetadataTable.get(tableId);
      if (!table) return;
      
      // Add reference if not already present
      if (!table.nodeIds.includes(nodeId)) {
        table.nodeIds.push(nodeId);
        table.referenceCount = table.nodeIds.length;
        table.lastAccessedAt = Date.now();
        
        await this.tableMetadataTable.put(table);
      }
    });
  }
  
  async removeReference(tableId: EntityId, nodeId: NodeId): Promise<void> {
    await this.db.transaction('rw', this.tableMetadataTable, async () => {
      const table = await this.tableMetadataTable.get(tableId);
      if (!table) return;
      
      // Remove reference
      table.nodeIds = table.nodeIds.filter(id => id !== nodeId);
      table.referenceCount = table.nodeIds.length;
      
      if (table.referenceCount === 0) {
        // No more references, delete table
        await this.tableMetadataTable.delete(tableId);
        await this.cleanupTableData(tableId);
      } else {
        await this.tableMetadataTable.put(table);
      }
    });
  }
  
  async cleanupOrphanedTables(): Promise<void> {
    const orphanedTables = await this.tableMetadataTable
      .where('referenceCount')
      .equals(0)
      .toArray();
    
    for (const table of orphanedTables) {
      await this.cleanupTableData(table.id);
      await this.tableMetadataTable.delete(table.id);
    }
  }
}
```

### Data Processing Pipeline

**Progressive Processing Lifecycle**
```typescript
interface ProcessingPipeline {
  // Stage 1: Raw data import
  import: (file: File) => Promise<RawTableData>;
  
  // Stage 2: Parsing and validation
  parse: (rawData: RawTableData) => Promise<ParsedTableData>;
  
  // Stage 3: Analysis and statistics
  analyze: (parsedData: ParsedTableData) => Promise<AnalyzedTableData>;
  
  // Stage 4: Optimization and indexing
  optimize: (analyzedData: AnalyzedTableData) => Promise<OptimizedTableData>;
  
  // Stage 5: Storage and finalization
  store: (optimizedData: OptimizedTableData) => Promise<TableMetadataEntity>;
}

class TableProcessingLifecycle implements ProcessingPipeline {
  async processTable(file: File, nodeId: NodeId): Promise<TableMetadataEntity> {
    try {
      // Progressive processing with status updates
      this.updateStatus('importing', 0);
      const rawData = await this.import(file);
      
      this.updateStatus('parsing', 25);
      const parsedData = await this.parse(rawData);
      
      this.updateStatus('analyzing', 50);
      const analyzedData = await this.analyze(parsedData);
      
      this.updateStatus('optimizing', 75);
      const optimizedData = await this.optimize(analyzedData);
      
      this.updateStatus('storing', 90);
      const tableMetadata = await this.store(optimizedData);
      
      this.updateStatus('complete', 100);
      return tableMetadata;
      
    } catch (error) {
      this.updateStatus('error', 0, error);
      throw error;
    }
  }
}
```

## Style Generation Lifecycle

### Configuration and Generation

**Style Processing Pipeline**
```typescript
class StyleGenerationLifecycle {
  async generateStyles(
    entity: StyleMapEntity,
    tableData: TableData
  ): Promise<MapLibreStyle> {
    // 1. Configuration validation
    this.validateStyleConfig(entity.styleMapConfig);
    
    // 2. Data preparation
    const filteredData = await this.applyFilters(tableData, entity.filterRules);
    const keyValues = this.extractKeyValues(filteredData, entity.selectedKeyColumn);
    
    // 3. Color mapping generation
    const colorMapping = await this.generateColorMapping(
      keyValues,
      entity.styleMapConfig
    );
    
    // 4. MapLibre style generation
    const mapLibreStyle = await this.generateMapLibreStyle(
      colorMapping,
      entity.styleMapConfig
    );
    
    // 5. Caching
    const cacheKey = this.generateCacheKey(entity);
    await this.cacheStyle(cacheKey, mapLibreStyle);
    
    return mapLibreStyle;
  }
  
  private generateCacheKey(entity: StyleMapEntity): string {
    const configData = {
      tableMetadataId: entity.tableMetadataId,
      filterRules: entity.filterRules,
      selectedKeyColumn: entity.selectedKeyColumn,
      selectedValueColumns: entity.selectedValueColumns,
      styleMapConfig: entity.styleMapConfig,
    };
    
    return this.hashObject(configData);
  }
}
```

### Cache Management

**Style Cache Lifecycle**
```typescript
interface StyleCacheManager {
  // Cache operations
  cacheStyle(key: string, style: MapLibreStyle): Promise<void>;
  getCachedStyle(key: string): Promise<MapLibreStyle | null>;
  invalidateCache(key: string): Promise<void>;
  
  // Cleanup operations
  cleanupExpiredCache(): Promise<void>;
  clearCacheForEntity(entityId: EntityId): Promise<void>;
}

class StyleCacheLifecycle implements StyleCacheManager {
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  
  async cacheStyle(key: string, style: MapLibreStyle): Promise<void> {
    const cacheEntry = {
      key,
      style,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.CACHE_TTL,
      hitCount: 0,
    };
    
    await this.styleCacheTable.put(cacheEntry);
  }
  
  async getCachedStyle(key: string): Promise<MapLibreStyle | null> {
    const entry = await this.styleCacheTable.get(key);
    
    if (!entry) return null;
    
    // Check expiration
    if (entry.expiresAt < Date.now()) {
      await this.styleCacheTable.delete(key);
      return null;
    }
    
    // Update hit count
    entry.hitCount++;
    await this.styleCacheTable.put(entry);
    
    return entry.style;
  }
  
  async cleanupExpiredCache(): Promise<void> {
    const now = Date.now();
    await this.styleCacheTable
      .where('expiresAt')
      .below(now)
      .delete();
  }
}
```

## Error Handling and Recovery

### Lifecycle Error Management

**Error Recovery Strategies**
```typescript
class LifecycleErrorHandler {
  async handleEntityCreationError(
    error: Error,
    nodeId: NodeId,
    data: Partial<StyleMapEntity>
  ): Promise<void> {
    // Log error details
    await this.logError('ENTITY_CREATION_FAILED', error, { nodeId, data });
    
    // Cleanup partial state
    await this.cleanupPartialEntity(nodeId);
    
    // Notify user
    await this.notifyError('Failed to create StyleMap entity', error);
  }
  
  async handleTableImportError(
    error: Error,
    file: File,
    nodeId: NodeId
  ): Promise<void> {
    // Log import failure
    await this.logError('TABLE_IMPORT_FAILED', error, { 
      filename: file.name, 
      fileSize: file.size,
      nodeId 
    });
    
    // Cleanup temporary data
    await this.cleanupTempData(nodeId);
    
    // Provide recovery options
    await this.suggestRecoveryOptions(error, file);
  }
  
  async handleStyleGenerationError(
    error: Error,
    entity: StyleMapEntity
  ): Promise<void> {
    // Log generation failure
    await this.logError('STYLE_GENERATION_FAILED', error, { entityId: entity.id });
    
    // Clear invalid cache
    if (entity.cacheKey) {
      await this.invalidateCache(entity.cacheKey);
    }
    
    // Use fallback style
    await this.generateFallbackStyle(entity);
  }
}
```

### Cleanup and Maintenance

**Scheduled Maintenance Tasks**
```typescript
class LifecycleMaintenance {
  async scheduleMaintenanceTasks(): Promise<void> {
    // Daily cleanup
    setInterval(async () => {
      await this.cleanupExpiredWorkingCopies();
      await this.cleanupOrphanedTables();
      await this.cleanupExpiredCache();
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    // Weekly optimization
    setInterval(async () => {
      await this.optimizeDatabase();
      await this.rebuildIndices();
      await this.compactStorage();
    }, 7 * 24 * 60 * 60 * 1000); // 7 days
  }
  
  async cleanupExpiredWorkingCopies(): Promise<void> {
    const expiredCopies = await this.workingCopyTable
      .where('copiedAt')
      .below(Date.now() - this.WORKING_COPY_TTL)
      .toArray();
    
    for (const copy of expiredCopies) {
      await this.discardWorkingCopy(copy.workingCopyId);
    }
  }
}
```

---

**Lifecycle Management Status**: Core patterns implemented, cleanup operations in progress  
**Next Priority**: Complete reference counting and cache management  
**Maintenance Strategy**: Automated cleanup with manual optimization options