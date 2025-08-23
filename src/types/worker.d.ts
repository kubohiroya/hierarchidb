/**
 * Type declarations for @hierarchidb/worker module
 * This file provides type safety for worker package imports
 */

declare module '@hierarchidb/worker' {
  import type { NodeId, EntityBackup } from '@hierarchidb/core';

  // Base entity handler interface
  export interface EntityHandler<TEntity, TGroupEntity, TWorkingCopy> {
    // CRUD operations
    createEntity(nodeId: NodeId, data?: Partial<TEntity>): Promise<TEntity>;
    getEntity(nodeId: NodeId): Promise<TEntity | null>;
    updateEntity(nodeId: NodeId, data: Partial<TEntity>): Promise<void>;
    deleteEntity(nodeId: NodeId): Promise<void>;
    
    // Working copy operations
    createWorkingCopy(nodeId: NodeId): Promise<TWorkingCopy>;
    getWorkingCopy(workingCopyId: string): Promise<TWorkingCopy | null>;
    updateWorkingCopy(workingCopyId: string, data: Partial<TWorkingCopy>): Promise<void>;
    commitWorkingCopy(workingCopyId: string): Promise<void>;
    discardWorkingCopy(workingCopyId: string): Promise<void>;
    
    // Backup operations
    backup(nodeId: NodeId): Promise<EntityBackup<TEntity>>;
    restore(nodeId: NodeId, backup: EntityBackup<TEntity>): Promise<void>;
    
    // Cleanup
    cleanup(nodeId: NodeId): Promise<void>;
  }

  // Base entity handler class
  export abstract class BaseEntityHandler<TEntity, TGroupEntity, TWorkingCopy> 
    implements EntityHandler<TEntity, TGroupEntity, TWorkingCopy> {
    
    protected db: any;
    protected tableName: string;
    protected workingCopyTableName: string;
    
    constructor(db: any, tableName: string, workingCopyTableName: string);
    
    // Properties that must be implemented by subclasses
    abstract generateNodeId(): NodeId;
    abstract now(): number;
    abstract validateEntity(entity: Partial<TEntity>): { valid: boolean; errors: string[] };
    abstract log(level: 'info' | 'warn' | 'error', message: string, data?: any): void;
    
    // CRUD operations
    abstract createEntity(nodeId: NodeId, data?: Partial<TEntity>): Promise<TEntity>;
    abstract getEntity(nodeId: NodeId): Promise<TEntity | null>;
    abstract updateEntity(nodeId: NodeId, data: Partial<TEntity>): Promise<void>;
    abstract deleteEntity(nodeId: NodeId): Promise<void>;
    
    // Working copy operations
    abstract createWorkingCopy(nodeId: NodeId): Promise<TWorkingCopy>;
    abstract getWorkingCopy(workingCopyId: string): Promise<TWorkingCopy | null>;
    abstract updateWorkingCopy(workingCopyId: string, data: Partial<TWorkingCopy>): Promise<void>;
    abstract commitWorkingCopy(workingCopyId: string): Promise<void>;
    abstract discardWorkingCopy(workingCopyId: string): Promise<void>;
    
    // Backup operations
    abstract backup(nodeId: NodeId): Promise<EntityBackup<TEntity>>;
    abstract restore(nodeId: NodeId, backup: EntityBackup<TEntity>): Promise<void>;
    
    // Cleanup
    abstract cleanup(nodeId: NodeId): Promise<void>;
  }
}