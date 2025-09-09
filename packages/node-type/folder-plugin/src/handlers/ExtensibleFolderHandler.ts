import { FolderEntityHandler } from './FolderEntityHandler';
import { folderExtensionRegistry } from '../api/FolderExtensionAPI';
import type { FolderEntity } from '../entities/FolderEntity';
import type { NodeId } from '@hierarchidb/common-type';

/**
 * Extended folder-plugin entity handler that supports plugin extensions
 */
export class ExtensibleFolderHandler extends FolderEntityHandler {
  constructor() {
    super();
  }

  /**
   * Create entity with extension support
   */
  async createEntity(
    nodeId: NodeId,
    data?: Partial<FolderEntity>,
  ): Promise<FolderEntity> {
    // Apply extension transformations before save
    const transformedData = await folderExtensionRegistry.beforeSaveEntity(data || {});

    // Validate with extensions
    const validationErrors = await folderExtensionRegistry.validateEntity(transformedData);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Create entity using base handler
    const entity = await super.createEntity(nodeId, transformedData);

    // Apply extension transformations after load
    const finalEntity = await folderExtensionRegistry.afterLoadEntity(entity);

    // Execute extension lifecycle hooks would be implemented here
    // when we have access to the node via a service

    return finalEntity;
  }

  /**
   * Update entity with extension support
   */
  async updateEntity(
    nodeId: NodeId,
    changes: Partial<FolderEntity>,
  ): Promise<void> {
    // Get current entity
    const currentEntity = await this.getEntity(nodeId);
    if (!currentEntity) {
      throw new Error(`Entity not found: ${nodeId}`);
    }

    // Execute before update hooks would be implemented here
    // when we have access to the node via a service

    // Apply extension transformations before save
    const transformedChanges = await folderExtensionRegistry.beforeSaveEntity(changes);

    // Validate the updated entity
    const updatedEntity = { ...currentEntity, ...transformedChanges };
    const validationErrors = await folderExtensionRegistry.validateEntity(updatedEntity);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Update entity using base handler
    await super.updateEntity(nodeId, transformedChanges);

    // Get updated entity for hooks would be implemented here
    // when we have access to the node via a service
  }

  /**
   * Get entity with extension support
   */
  async getEntity(nodeId: NodeId): Promise<FolderEntity | undefined> {
    const entity = await super.getEntity(nodeId);

    if (!entity) {
      return undefined;
    }

    // Apply extension transformations after load
    return await folderExtensionRegistry.afterLoadEntity(entity);
  }

  /**
   * Get entity by node ID with extension support
   */
  async getEntityByNodeId(nodeId: NodeId): Promise<FolderEntity | undefined> {
    // Use getEntity instead since the base class uses nodeId as parameter
    return this.getEntity(nodeId);
  }

  /**
   * Delete entity with extension support
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    // Get entity before deletion
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Entity not found: ${nodeId}`);
    }

    // Execute before delete hooks would be implemented here
    // when we have access to the node via a service

    // Delete entity using base handler
    await super.deleteEntity(nodeId);
  }

  /**
   * Get extended data from entity (for extension use)
   */
  async getExtendedData(entity: FolderEntity): Promise<Record<string, any>> {
    const extendedData: Record<string, any> = {};

    // Collect extended data from all extensions
    const extensions = folderExtensionRegistry.getAllExtensions();
    for (const ext of extensions) {
      // Extension data methods will be implemented when extensions are available
      if (ext.entity && typeof (ext.entity as any).getExtendedData === 'function') {
        const data = await (ext.entity as any).getExtendedData(entity);
        Object.assign(extendedData, data);
      }
    }

    return extendedData;
  }

  /**
   * Save extended data to entity (for extension use)
   */
  async saveExtendedData(
    entity: FolderEntity,
    extendedData: Record<string, any>,
  ): Promise<void> {
    // Let each extension save its data
    const extensions = folderExtensionRegistry.getAllExtensions();
    for (const ext of extensions) {
      // Extension data methods will be implemented when extensions are available
      if (ext.entity && typeof (ext.entity as any).saveExtendedData === 'function') {
        await (ext.entity as any).saveExtendedData(entity, extendedData);
      }
    }
  }

  /**
   * Validate entity with base and extension rules
   */
  async validateEntity(entity: Partial<FolderEntity>): Promise<string[]> {
    const errors: string[] = [];

    // Base validation
    if (!entity.name?.trim()) {
      errors.push('Folder name is required');
    } else if (entity.name.length > 255) {
      errors.push('Folder name is too long');
    } else if (!/^[^<>:"/\\|?*]+$/.test(entity.name)) {
      errors.push('Folder name contains invalid characters');
    }

    // Extension validation
    const extensionErrors = await folderExtensionRegistry.validateEntity(entity);
    errors.push(...extensionErrors);

    return errors;
  }

  /**
   * Clone the handler for a different database instance
   */
  clone(): ExtensibleFolderHandler {
    return new ExtensibleFolderHandler();
  }
}