/**
 * @file MetadataEntityHandler.ts
 * @description Base handler for entities with extensible metadata
 */

import type { EntityId } from '@hierarchidb/common-type';
import type { Collection } from 'dexie';
import { BaseEntityHandler } from './BaseEntityHandler';
import type { BaseEntity, BaseWorkingCopy, BaseSearchCriteria } from '../types';

/**
 * Entity interface with metadata support
 */
export interface MetadataEntity extends BaseEntity {
  metadata?: Record<string, any>;
  tags?: string[];
  customFields?: Record<string, any>;
}

/**
 * Metadata search criteria
 */
export interface MetadataSearchCriteria extends BaseSearchCriteria {
  hasMetadata?: boolean;
  metadataKeys?: string[];
  tags?: string[];
  tagMatch?: 'any' | 'all';
}

/**
 * Metadata operation result
 */
export interface MetadataOperationResult {
  success: boolean;
  key?: string;
  value?: any;
  previousValue?: any;
}

/**
 * Abstract base class for entities with metadata management
 */
export abstract class MetadataEntityHandler<
  TEntity extends MetadataEntity,
  TWorkingCopy extends BaseWorkingCopy,
  TCreateData extends Partial<TEntity> = Partial<TEntity>,
  TSearchCriteria extends MetadataSearchCriteria = MetadataSearchCriteria,
> extends BaseEntityHandler<TEntity, TWorkingCopy, TCreateData, TSearchCriteria> {
  /**
   * Set metadata value for a key
   */
  async setMetadata(entityId: EntityId, key: string, value: any): Promise<MetadataOperationResult> {
    try {
      const entity = await this.getEntity(entityId);
      if (!entity) {
        throw new Error(`Entity not found: ${entityId}`);
      }

      const metadata = entity.metadata || {};
      const previousValue = metadata[key];
      metadata[key] = value;

      await this.updateEntity(entityId, { metadata } as Partial<TEntity>);

      return {
        success: true,
        key,
        value,
        previousValue,
      };
    } catch (error) {
      console.error('Failed to set metadata:', error);
      throw error;
    }
  }

  /**
   * Get metadata value for a key
   */
  async getMetadata(entityId: EntityId, key: string): Promise<any> {
    try {
      const entity = await this.getEntity(entityId);
      return entity?.metadata?.[key];
    } catch (error) {
      console.error('Failed to get metadata:', error);
      throw error;
    }
  }

  /**
   * Get all metadata for an entity
   */
  async getAllMetadata(entityId: EntityId): Promise<Record<string, any> | undefined> {
    try {
      const entity = await this.getEntity(entityId);
      return entity?.metadata;
    } catch (error) {
      console.error('Failed to get all metadata:', error);
      throw error;
    }
  }

  /**
   * Delete metadata value for a key
   */
  async deleteMetadata(entityId: EntityId, key: string): Promise<MetadataOperationResult> {
    try {
      const entity = await this.getEntity(entityId);
      if (!entity?.metadata) {
        return { success: false, key };
      }

      const previousValue = entity.metadata[key];
      delete entity.metadata[key];

      await this.updateEntity(entityId, { metadata: entity.metadata } as Partial<TEntity>);

      return {
        success: true,
        key,
        previousValue,
      };
    } catch (error) {
      console.error('Failed to delete metadata:', error);
      throw error;
    }
  }

  /**
   * Clear all metadata
   */
  async clearMetadata(entityId: EntityId): Promise<void> {
    try {
      await this.updateEntity(entityId, { metadata: {} } as Partial<TEntity>);
    } catch (error) {
      console.error('Failed to clear metadata:', error);
      throw error;
    }
  }

  /**
   * Batch set metadata
   */
  async batchSetMetadata(entityId: EntityId, metadata: Record<string, any>): Promise<void> {
    try {
      const entity = await this.getEntity(entityId);
      if (!entity) {
        throw new Error(`Entity not found: ${entityId}`);
      }

      const updatedMetadata = {
        ...(entity.metadata || {}),
        ...metadata,
      };

      await this.updateEntity(entityId, { metadata: updatedMetadata } as Partial<TEntity>);
    } catch (error) {
      console.error('Failed to batch set metadata:', error);
      throw error;
    }
  }

  /**
   * Check if entity has metadata key
   */
  async hasMetadataKey(entityId: EntityId, key: string): Promise<boolean> {
    try {
      const entity = await this.getEntity(entityId);
      return entity?.metadata?.hasOwnProperty(key) || false;
    } catch (error) {
      console.error('Failed to check metadata key:', error);
      throw error;
    }
  }

  /**
   * Get metadata keys
   */
  async getMetadataKeys(entityId: EntityId): Promise<string[]> {
    try {
      const entity = await this.getEntity(entityId);
      if (!entity?.metadata) {
        return [];
      }
      return Object.keys(entity.metadata);
    } catch (error) {
      console.error('Failed to get metadata keys:', error);
      throw error;
    }
  }

  /**
   * Add tag to entity
   */
  async addTag(entityId: EntityId, tag: string): Promise<void> {
    try {
      const entity = await this.getEntity(entityId);
      if (!entity) {
        throw new Error(`Entity not found: ${entityId}`);
      }

      const tags = entity.tags || [];
      if (!tags.includes(tag)) {
        tags.push(tag);
        await this.updateEntity(entityId, { tags } as Partial<TEntity>);
      }
    } catch (error) {
      console.error('Failed to add tag:', error);
      throw error;
    }
  }

  /**
   * Remove tag from entity
   */
  async removeTag(entityId: EntityId, tag: string): Promise<void> {
    try {
      const entity = await this.getEntity(entityId);
      if (!entity?.tags) {
        return;
      }

      const tags = entity.tags.filter((t) => t !== tag);
      await this.updateEntity(entityId, { tags } as Partial<TEntity>);
    } catch (error) {
      console.error('Failed to remove tag:', error);
      throw error;
    }
  }

  /**
   * Get all tags for entity
   */
  async getTags(entityId: EntityId): Promise<string[]> {
    try {
      const entity = await this.getEntity(entityId);
      return entity?.tags || [];
    } catch (error) {
      console.error('Failed to get tags:', error);
      throw error;
    }
  }

  /**
   * Check if entity has tag
   */
  async hasTag(entityId: EntityId, tag: string): Promise<boolean> {
    try {
      const tags = await this.getTags(entityId);
      return tags.includes(tag);
    } catch (error) {
      console.error('Failed to check tag:', error);
      throw error;
    }
  }

  /**
   * Set tags (replace all)
   */
  async setTags(entityId: EntityId, tags: string[]): Promise<void> {
    try {
      await this.updateEntity(entityId, { tags } as Partial<TEntity>);
    } catch (error) {
      console.error('Failed to set tags:', error);
      throw error;
    }
  }

  /**
   * Clear all tags
   */
  async clearTags(entityId: EntityId): Promise<void> {
    try {
      await this.updateEntity(entityId, { tags: [] } as unknown as Partial<TEntity>);
    } catch (error) {
      console.error('Failed to clear tags:', error);
      throw error;
    }
  }

  /**
   * Set custom field
   */
  async setCustomField(entityId: EntityId, field: string, value: any): Promise<void> {
    try {
      const entity = await this.getEntity(entityId);
      if (!entity) {
        throw new Error(`Entity not found: ${entityId}`);
      }

      const customFields = entity.customFields || {};
      customFields[field] = value;

      await this.updateEntity(entityId, { customFields } as Partial<TEntity>);
    } catch (error) {
      console.error('Failed to set custom field:', error);
      throw error;
    }
  }

  /**
   * Get custom field
   */
  async getCustomField(entityId: EntityId, field: string): Promise<any> {
    try {
      const entity = await this.getEntity(entityId);
      return entity?.customFields?.[field];
    } catch (error) {
      console.error('Failed to get custom field:', error);
      throw error;
    }
  }

  /**
   * Delete custom field
   */
  async deleteCustomField(entityId: EntityId, field: string): Promise<void> {
    try {
      const entity = await this.getEntity(entityId);
      if (!entity?.customFields) {
        return;
      }

      delete entity.customFields[field];
      await this.updateEntity(entityId, { customFields: entity.customFields } as Partial<TEntity>);
    } catch (error) {
      console.error('Failed to delete custom field:', error);
      throw error;
    }
  }

  /**
   * Get all custom fields
   */
  async getCustomFields(entityId: EntityId): Promise<Record<string, any> | undefined> {
    try {
      const entity = await this.getEntity(entityId);
      return entity?.customFields;
    } catch (error) {
      console.error('Failed to get custom fields:', error);
      throw error;
    }
  }

  /**
   * Search by metadata
   */
  async searchByMetadata(key: string, value: any): Promise<TEntity[]> {
    try {
      return await this.table.filter((entity) => entity.metadata?.[key] === value).toArray();
    } catch (error) {
      console.error('Failed to search by metadata:', error);
      throw error;
    }
  }

  /**
   * Search by tags
   */
  async searchByTags(tags: string[], matchAll: boolean = false): Promise<TEntity[]> {
    try {
      return await this.table
        .filter((entity) => {
          if (!entity.tags || entity.tags.length === 0) {
            return false;
          }

          if (matchAll) {
            return tags.every((tag) => entity.tags!.includes(tag));
          } else {
            return tags.some((tag) => entity.tags!.includes(tag));
          }
        })
        .toArray();
    } catch (error) {
      console.error('Failed to search by tags:', error);
      throw error;
    }
  }

  /**
   * Apply additional search criteria for metadata entities
   */
  protected applyAdditionalSearchCriteria(
    query: Collection<TEntity>,
    criteria: TSearchCriteria
  ): Collection<TEntity, any> {
    if (criteria.hasMetadata !== undefined) {
      query = query.filter((entity) => {
        const hasMetadata = entity.metadata && Object.keys(entity.metadata).length > 0;
        return hasMetadata === criteria.hasMetadata;
      });
    }

    if (criteria.metadataKeys && criteria.metadataKeys.length > 0) {
      query = query.filter((entity) => {
        if (!entity.metadata) return false;
        return criteria.metadataKeys!.every((key) => entity.metadata!.hasOwnProperty(key));
      });
    }

    if (criteria.tags && criteria.tags.length > 0) {
      query = query.filter((entity) => {
        if (!entity.tags || entity.tags.length === 0) return false;

        if (criteria.tagMatch === 'all') {
          return criteria.tags!.every((tag) => entity.tags!.includes(tag));
        } else {
          return criteria.tags!.some((tag) => entity.tags!.includes(tag));
        }
      });
    }

    return query;
  }

  /**
   * Merge metadata from source entity to target entity
   */
  async mergeMetadata(
    sourceEntityId: EntityId,
    targetEntityId: EntityId,
    overwrite: boolean = false
  ): Promise<void> {
    try {
      const source = await this.getEntity(sourceEntityId);
      const target = await this.getEntity(targetEntityId);

      if (!source || !target) {
        throw new Error('Source or target entity not found');
      }

      const mergedMetadata = overwrite
        ? { ...(target.metadata || {}), ...(source.metadata || {}) }
        : { ...(source.metadata || {}), ...(target.metadata || {}) };

      await this.updateEntity(targetEntityId, { metadata: mergedMetadata } as Partial<TEntity>);
    } catch (error) {
      console.error('Failed to merge metadata:', error);
      throw error;
    }
  }

  /**
   * Copy metadata from one entity to another
   */
  async copyMetadata(sourceEntityId: EntityId, targetEntityId: EntityId): Promise<void> {
    try {
      const source = await this.getEntity(sourceEntityId);
      if (!source) {
        throw new Error(`Source entity not found: ${sourceEntityId}`);
      }

      await this.updateEntity(targetEntityId, {
        metadata: { ...(source.metadata || {}) },
        tags: [...(source.tags || [])],
        customFields: { ...(source.customFields || {}) },
      } as Partial<TEntity>);
    } catch (error) {
      console.error('Failed to copy metadata:', error);
      throw error;
    }
  }
}
