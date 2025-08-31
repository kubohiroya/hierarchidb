/**
 * @file handler.ts
 * @description Shape extension handler
 *
 * This handler extends the FolderEntityHandler to provide Shape-specific
 * functionality while inheriting basic folder-plugin operations.
 */

import type { NodeId } from '@hierarchidb/common-type';
import { FolderEntityHandler } from '@hierarchidb/folder-plugin';
import type { BaseEntityExtension } from '@hierarchidb/common-type';
import type { FolderEntity } from '@hierarchidb/folder-plugin';
import type { DataSourceName, ShapeEntity } from '../types';
import { ShapeEntityHandler as OriginalShapeEntityHandler } from '../worker/handlers/ShapeEntityHandler';

/**
 * ShapeEntityHandler that extends FolderEntityHandler
 * Combines folder-plugin functionality with Shape-specific operations
 */
export class ShapeExtensionHandler
  extends FolderEntityHandler
  implements BaseEntityExtension<FolderEntity, ShapeEntity>
{
  private originalHandler: OriginalShapeEntityHandler;

  constructor() {
    super();
    this.originalHandler = new OriginalShapeEntityHandler();
  }

  /**
   * Get Shape-specific extended data
   */
  async getExtendedData(nodeId: NodeId): Promise<Partial<ShapeEntity>> {
    try {
      // Get the full Shape entity using the original handler
      const shapeEntity = await this.originalHandler.getEntityByNodeId(nodeId);
      if (!shapeEntity) return {};

      // Return Shape-specific fields (excluding folder-plugin fields)
      return {
        dataSourceName: shapeEntity.dataSourceName,
        selectedCountries: shapeEntity.selectedCountries,
        adminLevels: shapeEntity.adminLevels,
        licenseAgreement: shapeEntity.licenseAgreement,
        processingConfig: shapeEntity.processingConfig,
      };
    } catch (error) {
      console.error('Failed to get Shape extended data:', error);
      return {};
    }
  }

  /**
   * Save Shape-specific extended data
   */
  async saveExtendedData(nodeId: NodeId, data: Partial<ShapeEntity>): Promise<void> {
    try {
      // 1) Ensure base Folder entity exists or create it
      const existingFolder = await super.getEntity(nodeId);
      if (existingFolder) {
        await super.updateEntity(nodeId, {
          name: data.name || existingFolder.name || 'Untitled Shape Configuration',
          description: data.description ?? existingFolder.description,
          updatedAt: Date.now(),
        });
      } else {
        await super.createEntity(nodeId, {
          name: data.name || 'Untitled Shape Configuration',
          description: data.description,
        } as any);
      }

      // 2) Save/Update Shape-specific data via worker handler
      const existingShape = await this.originalHandler.getEntityByNodeId(nodeId);
      if (existingShape) {
        await this.originalHandler.updateEntity(existingShape.id, {
          ...data,
          updatedAt: Date.now(),
        } as Partial<ShapeEntity>);
      } else {
        const folderEntity = await super.getEntity(nodeId);
        await this.originalHandler.createEntity(nodeId, {
          name: folderEntity?.name || data.name || 'Untitled Shape Configuration',
          description: folderEntity?.description || data.description || '',
          dataSourceName: (data.dataSourceName || 'naturalearth') as DataSourceName,
          // processingConfig is optional; worker handler will merge defaults if provided
          processingConfig: (data as any).processingConfig,
        } as any);
      }
    } catch (error) {
      console.error('Failed to save Shape extended data:', error);
      throw error;
    }
  }
}
