-- ================================================================================
-- plugin-stylemap Database Schema Design
-- ================================================================================
-- @description IndexedDB schema definitions for plugin-stylemap
-- @based_on eria-cartograph StyleMapDB implementation
-- @framework hierarchidb with Dexie.js wrapper
-- @version 1.0.0
-- ================================================================================

-- ================================================================================
-- 🟢 Core Database Configuration
-- ================================================================================

-- Database Name: StyleMapDB
-- Framework: IndexedDB via Dexie.js
-- Schema Version: 1
-- Isolation: Plugin-specific database instance

-- Primary Database Instance
-- CREATE DATABASE stylemap_db;
-- Note: IndexedDB databases are created automatically by Dexie

-- ================================================================================
-- 🟢 Primary Tables (Object Stores)
-- ================================================================================

-- ------------------------------------------------------------------------------
-- StyleMapEntity Store
-- 🟢 Main entity for storing style map configurations
-- ------------------------------------------------------------------------------
-- Dexie Schema Definition:
-- styleMapEntities: "&nodeId, fileContentHash, workingCopyOf"

/*
CREATE TABLE style_map_entities (
    -- Primary key (TreeNodeId)
    nodeId VARCHAR(255) PRIMARY KEY,
    
    -- Basic metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- File reference
    filename VARCHAR(255),
    cacheKey VARCHAR(255),
    downloadUrl TEXT,
    contentHash VARCHAR(64), -- SHA3-256 hash
    
    -- Table reference
    tableMetadataId UUID,
    
    -- Column mapping
    keyColumn VARCHAR(255),
    valueColumn VARCHAR(255),
    
    -- Configuration (JSON serialized)
    filterRules JSON, -- FilterRule[]
    styleMapConfig JSON, -- StyleMapConfig
    
    -- Working copy management
    workingCopyOf VARCHAR(255), -- Reference to original entity
    isWorkingCopy BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Entity metadata (TreeEntity inheritance)
    type VARCHAR(50) DEFAULT 'stylemap',
    parentId VARCHAR(255),
    isDraft BOOLEAN DEFAULT FALSE,
    
    -- Index signature compatibility
    -- Additional dynamic properties stored as JSON
    
    FOREIGN KEY (tableMetadataId) REFERENCES table_metadata_entities(id),
    FOREIGN KEY (workingCopyOf) REFERENCES style_map_entities(nodeId)
);
*/

-- 🟢 Dexie.js Primary Key and Indexes
-- Primary Key: nodeId (TreeNodeId)
-- Indexes:
--   - fileContentHash (for deduplication queries)
--   - workingCopyOf (for working copy queries)
--   - tableMetadataId (for join queries)
--   - parentId (for hierarchical queries)
--   - createdAt (for temporal queries)

-- ------------------------------------------------------------------------------
-- TableMetadataEntity Store  
-- 🟢 Metadata for CSV/TSV table structures with deduplication
-- ------------------------------------------------------------------------------
-- Dexie Schema Definition:
-- tableMetadataEntities: "$$id, &contentHash, filename, referenceCount"

/*
CREATE TABLE table_metadata_entities (
    -- Primary key (UUID)
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Deduplication key
    contentHash VARCHAR(64) UNIQUE NOT NULL, -- SHA3-256 hash
    
    -- File metadata
    filename VARCHAR(255) NOT NULL,
    fileSize INTEGER NOT NULL,
    
    -- Table structure
    columns JSON NOT NULL, -- string[] - column names in order
    rowCount INTEGER NOT NULL DEFAULT 0,
    
    -- Reference counting for garbage collection
    referenceCount INTEGER NOT NULL DEFAULT 1,
    
    -- Timestamps
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
*/

-- 🟢 Dexie.js Configuration
-- Primary Key: id (auto-generated UUID)
-- Unique Index: contentHash (for deduplication)
-- Indexes:
--   - filename (for file name searches)
--   - referenceCount (for garbage collection)
--   - createdAt (for temporal operations)

-- ------------------------------------------------------------------------------
-- RowEntity Store
-- 🟢 Individual row data with space-efficient storage
-- ------------------------------------------------------------------------------
-- Dexie Schema Definition:
-- rowEntities: "$$id, &[t+r], v"

/*
CREATE TABLE row_entities (
    -- Primary key (UUID)
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Table reference (foreign key)
    t UUID NOT NULL, -- tableId (shortened for storage efficiency)
    
    -- Row position
    r INTEGER NOT NULL, -- rowIndex within table
    
    -- Row data (JSON array)
    v JSON NOT NULL, -- values: (string | number | null)[]
    
    -- Composite unique constraint
    UNIQUE(t, r),
    
    FOREIGN KEY (t) REFERENCES table_metadata_entities(id)
);
*/

-- 🟢 Dexie.js Configuration
-- Primary Key: id (auto-generated UUID)
-- Compound Index: [t+r] (table + row index for efficient queries)
-- Single Index: v (for value-based filtering)

-- ================================================================================
-- 🟡 Working Copy Tables (EphemeralDB)
-- ================================================================================

-- ------------------------------------------------------------------------------
-- WorkingCopy Store (EphemeralDB)
-- 🟡 Temporary editing states with undo/redo support
-- ------------------------------------------------------------------------------
-- Dexie Schema Definition:
-- workingCopies: "&workingCopyId, originalId, sessionId"

/*
CREATE TABLE working_copies (
    -- Primary key
    workingCopyId UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to original entity
    originalId VARCHAR(255),
    
    -- Session management
    sessionId VARCHAR(255),
    
    -- Current working state (full StyleMapEntity clone)
    currentState JSON NOT NULL,
    
    -- Pending changes not yet applied
    pendingChanges JSON,
    
    -- Timestamps
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Auto-cleanup after 24 hours
    expiresAt TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 HOURS'),
    
    FOREIGN KEY (originalId) REFERENCES style_map_entities(nodeId)
);
*/

-- ------------------------------------------------------------------------------
-- UndoRedoBuffer Store (EphemeralDB)
-- 🟡 Command history for undo/redo operations
-- ------------------------------------------------------------------------------
-- Dexie Schema Definition:
-- undoRedoBuffer: "&commandId, workingCopyId, sequence"

/*
CREATE TABLE undo_redo_buffer (
    -- Primary key
    commandId UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Working copy reference
    workingCopyId UUID NOT NULL,
    
    -- Command sequence (for ordering)
    sequence INTEGER NOT NULL,
    
    -- Command details
    commandType VARCHAR(50) NOT NULL, -- 'update', 'filter', 'configure'
    
    -- State before command (for undo)
    beforeState JSON,
    
    -- State after command (for redo)
    afterState JSON,
    
    -- Command metadata
    commandData JSON,
    
    -- Timestamp
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (workingCopyId) REFERENCES working_copies(workingCopyId)
);
*/

-- ================================================================================
-- 🟡 Cache Management Tables
-- ================================================================================

-- ------------------------------------------------------------------------------
-- FileCache Store (Browser Cache API Integration)
-- 🟡 File content caching with LRU eviction
-- ------------------------------------------------------------------------------
-- Note: Actual file content stored in Browser Cache API
-- This table manages metadata and references

/*
CREATE TABLE file_cache_metadata (
    -- Cache key (SHA3 hash + filename)
    cacheKey VARCHAR(255) PRIMARY KEY,
    
    -- File identification
    contentHash VARCHAR(64) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    originalUrl TEXT,
    
    -- Cache statistics
    accessCount INTEGER DEFAULT 1,
    lastAccessTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- File metadata
    fileSize INTEGER,
    mimeType VARCHAR(100),
    
    -- Cache expiration (24 hours default)
    expiresAt TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 HOURS'),
    
    -- Reference counting
    referenceCount INTEGER DEFAULT 1,
    
    -- Timestamps
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
*/

-- ================================================================================
-- 🟢 Database Indexes (Performance Optimization)
-- ================================================================================

-- Primary Entity Queries
-- CREATE INDEX idx_stylemap_parent ON style_map_entities(parentId);
-- CREATE INDEX idx_stylemap_type ON style_map_entities(type);
-- CREATE INDEX idx_stylemap_content_hash ON style_map_entities(contentHash);
-- CREATE INDEX idx_stylemap_created ON style_map_entities(createdAt);

-- Working Copy Queries  
-- CREATE INDEX idx_workingcopy_original ON working_copies(originalId);
-- CREATE INDEX idx_workingcopy_session ON working_copies(sessionId);
-- CREATE INDEX idx_workingcopy_expires ON working_copies(expiresAt);

-- Table Metadata Queries
-- CREATE INDEX idx_table_hash ON table_metadata_entities(contentHash);
-- CREATE INDEX idx_table_filename ON table_metadata_entities(filename);
-- CREATE INDEX idx_table_refcount ON table_metadata_entities(referenceCount);

-- Row Data Queries (Compound index already defined)
-- Compound index [t+r] covers most row queries efficiently

-- Undo/Redo Queries
-- CREATE INDEX idx_undo_workingcopy ON undo_redo_buffer(workingCopyId);
-- CREATE INDEX idx_undo_sequence ON undo_redo_buffer(workingCopyId, sequence);

-- Cache Management Queries
-- CREATE INDEX idx_cache_hash ON file_cache_metadata(contentHash);
-- CREATE INDEX idx_cache_access ON file_cache_metadata(lastAccessTime);
-- CREATE INDEX idx_cache_expires ON file_cache_metadata(expiresAt);

-- ================================================================================
-- 🟢 Database Constraints & Validation
-- ================================================================================

-- Data Integrity Constraints
/*
-- StyleMap entity validation
ALTER TABLE style_map_entities 
ADD CONSTRAINT chk_stylemap_type CHECK (type = 'stylemap');

ALTER TABLE style_map_entities
ADD CONSTRAINT chk_stylemap_node_id CHECK (LENGTH(nodeId) > 0);

-- Table metadata validation
ALTER TABLE table_metadata_entities
ADD CONSTRAINT chk_table_row_count CHECK (rowCount >= 0);

ALTER TABLE table_metadata_entities  
ADD CONSTRAINT chk_table_ref_count CHECK (referenceCount >= 0);

-- Row entity validation
ALTER TABLE row_entities
ADD CONSTRAINT chk_row_index CHECK (r >= 0);

-- Working copy validation
ALTER TABLE working_copies
ADD CONSTRAINT chk_working_copy_expires CHECK (expiresAt > createdAt);

-- Undo/Redo validation
ALTER TABLE undo_redo_buffer
ADD CONSTRAINT chk_undo_sequence CHECK (sequence >= 0);
*/

-- ================================================================================
-- 🟢 Data Migration Scripts
-- ================================================================================

-- 🟢 Schema Version 1 Migration (Initial)
/*
-- Initial schema creation
CREATE SCHEMA IF NOT EXISTS stylemap_v1;

-- Create all tables with initial structure
-- (Table creation statements above)

-- Insert schema version
INSERT INTO schema_versions (plugin_name, version, applied_at)
VALUES ('plugin-stylemap', 1, CURRENT_TIMESTAMP);
*/

-- 🟡 Future Schema Version 2 Migration (Example)
/*
-- Add new columns for enhanced features
ALTER TABLE style_map_entities 
ADD COLUMN exportSettings JSON;

ALTER TABLE table_metadata_entities
ADD COLUMN compressionType VARCHAR(50);

-- Update schema version
INSERT INTO schema_versions (plugin_name, version, applied_at)
VALUES ('plugin-stylemap', 2, CURRENT_TIMESTAMP);
*/

-- ================================================================================
-- 🟢 Database Maintenance Procedures
-- ================================================================================

-- 🟢 Garbage Collection for Orphaned Data
/*
-- Remove table metadata with zero references
DELETE FROM table_metadata_entities 
WHERE referenceCount = 0;

-- Remove orphaned row data
DELETE FROM row_entities 
WHERE t NOT IN (SELECT id FROM table_metadata_entities);

-- Clean expired working copies
DELETE FROM working_copies 
WHERE expiresAt < CURRENT_TIMESTAMP;

-- Clean orphaned undo/redo commands
DELETE FROM undo_redo_buffer 
WHERE workingCopyId NOT IN (SELECT workingCopyId FROM working_copies);

-- Clean expired cache entries
DELETE FROM file_cache_metadata 
WHERE expiresAt < CURRENT_TIMESTAMP;
*/

-- 🟡 Cache Optimization Procedures
/*
-- LRU eviction when cache size exceeds limit
WITH cache_lru AS (
    SELECT cacheKey 
    FROM file_cache_metadata 
    ORDER BY lastAccessTime ASC 
    LIMIT (
        SELECT COUNT(*) - :maxCacheEntries 
        FROM file_cache_metadata
    )
)
DELETE FROM file_cache_metadata 
WHERE cacheKey IN (SELECT cacheKey FROM cache_lru);

-- Update access statistics
UPDATE file_cache_metadata 
SET accessCount = accessCount + 1,
    lastAccessTime = CURRENT_TIMESTAMP
WHERE cacheKey = :cacheKey;
*/

-- ================================================================================
-- 🟢 Performance Monitoring Queries
-- ================================================================================

-- 🟢 Database Statistics
/*
-- StyleMap entity count by type
SELECT 
    type,
    COUNT(*) as entity_count,
    COUNT(CASE WHEN isDraft THEN 1 END) as draft_count
FROM style_map_entities 
GROUP BY type;

-- Table metadata storage efficiency
SELECT 
    AVG(fileSize) as avg_file_size,
    SUM(fileSize) as total_file_size,
    AVG(rowCount) as avg_row_count,
    COUNT(*) as table_count
FROM table_metadata_entities;

-- Working copy usage
SELECT 
    COUNT(*) as active_working_copies,
    AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - createdAt))/3600) as avg_age_hours
FROM working_copies
WHERE expiresAt > CURRENT_TIMESTAMP;

-- Cache efficiency
SELECT 
    COUNT(*) as cached_files,
    SUM(fileSize) as total_cache_size,
    AVG(accessCount) as avg_access_count,
    COUNT(CASE WHEN referenceCount > 1 THEN 1 END) as shared_files
FROM file_cache_metadata;
*/

-- ================================================================================
-- 🟢 Database Security & Access Control
-- ================================================================================

-- 🟢 Access Control (IndexedDB-specific considerations)
/*
-- Note: IndexedDB security is handled at the browser level
-- Each origin has isolated database access
-- Plugin-specific database ensures isolation from other plugins

-- Data sanitization for XSS prevention
-- Implemented in application layer:
-- - HTML tag removal from file content
-- - Script tag filtering
-- - URL validation for downloadUrl fields

-- Input validation constraints
-- Implemented in TypeScript interfaces and validation functions
-- - File size limits
-- - Column name validation  
-- - Filter rule validation
-- - Configuration value bounds checking
*/

-- ================================================================================
-- 🟡 Backup & Recovery Procedures
-- ================================================================================

-- 🟡 Export Schema for Backup
/*
-- Export all StyleMap entities
SELECT JSON_OBJECT(
    'entities', JSON_ARRAYAGG(
        JSON_OBJECT(
            'nodeId', nodeId,
            'name', name,
            'description', description,
            'config', styleMapConfig,
            'filters', filterRules,
            'tableId', tableMetadataId,
            'createdAt', createdAt
        )
    )
) as backup_data
FROM style_map_entities
WHERE type = 'stylemap';

-- Export table metadata with deduplication
SELECT JSON_OBJECT(
    'tables', JSON_ARRAYAGG(
        JSON_OBJECT(
            'id', id,
            'hash', contentHash,
            'filename', filename,
            'columns', columns,
            'rowCount', rowCount
        )
    )
) as table_backup
FROM table_metadata_entities;
*/

-- 🟡 Import Schema for Recovery
/*
-- Import StyleMap entities from backup
INSERT INTO style_map_entities (
    nodeId, name, description, styleMapConfig, 
    filterRules, tableMetadataId, createdAt
)
SELECT 
    backup.nodeId,
    backup.name, 
    backup.description,
    backup.config,
    backup.filters,
    backup.tableId,
    backup.createdAt
FROM JSON_TABLE(:backup_data, '$.entities[*]' COLUMNS (
    nodeId VARCHAR(255) PATH '$.nodeId',
    name VARCHAR(255) PATH '$.name',
    description TEXT PATH '$.description',
    config JSON PATH '$.config',
    filters JSON PATH '$.filters', 
    tableId UUID PATH '$.tableId',
    createdAt TIMESTAMP PATH '$.createdAt'
)) as backup;
*/

-- ================================================================================
-- Database Schema Summary
-- ================================================================================

/*
🟢 Core Tables:
- style_map_entities: Main StyleMap entities with configuration
- table_metadata_entities: CSV/TSV metadata with deduplication  
- row_entities: Normalized row data storage

🟡 Ephemeral Tables:
- working_copies: Temporary editing states
- undo_redo_buffer: Command history for undo/redo
- file_cache_metadata: Cache management metadata

🟢 Key Features:
- SHA3-based deduplication for file content
- Reference counting for garbage collection
- Working copy pattern for safe editing
- Undo/redo support with command history
- LRU cache eviction for performance
- Automatic cleanup of expired data

🟢 Performance Optimizations:
- Strategic indexing for common query patterns
- Compound indexes for multi-column queries
- Efficient storage with shortened column names
- JSON storage for complex configuration objects

🟡 Maintenance:
- Automated garbage collection procedures
- Cache optimization with LRU eviction
- Performance monitoring queries
- Backup/recovery procedures

This schema design ensures efficient storage, data integrity, and optimal performance
for the plugin-stylemap functionality while maintaining compatibility with the
hierarchidb framework and eria-cartograph patterns.
*/