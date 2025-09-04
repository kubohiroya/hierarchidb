/**
 * @file StylerEntityHandler.ts
 * @description Styler entity handler extending Spreadsheet functionality
 */

import type { NodeId } from '@hierarchidb/common-type';
import type { EntityHandler, GroupEntity } from '@hierarchidb/common-type';
import type { StylerEntity, StylerWorkingCopy } from '../entities/StylerEntity';
import { StylerConfigDefault } from '../types/stylerTypes';
import { StylerDataService } from '../services/StylerDataService';

// Type for base handler (since SpreadsheetEntityHandler is not exported)
interface BaseEntityHandler {
  createEntity(nodeId: NodeId, data: any): Promise<any>;
  getEntity(nodeId: NodeId): Promise<any>;
  updateEntity(nodeId: NodeId, data: any): Promise<any>;
  deleteEntity(nodeId: NodeId): Promise<any>;
}

/**
 * StylerEntityHandler
 * Extends SpreadsheetEntityHandler to add style map functionality
 */
export class StylerEntityHandler
  implements EntityHandler<StylerEntity, GroupEntity>
{
  private spreadsheetHandler: BaseEntityHandler;
  private dataService: StylerDataService;

  constructor(spreadsheetHandler: BaseEntityHandler, dataService: StylerDataService) {
    this.spreadsheetHandler = spreadsheetHandler;
    this.dataService = dataService;
  }

  async createEntity(nodeId: NodeId, data?: Partial<StylerEntity>): Promise<StylerEntity> {
    // Create base spreadsheet entity
    const baseEntity = await this.spreadsheetHandler.createEntity(nodeId, data);
    
    // Extend with Styler fields
    const entity: StylerEntity = {
      ...baseEntity,
      stylerConfig: data?.stylerConfig || StylerConfigDefault,
      selectedKeyColumn: data?.selectedKeyColumn || '',
      selectedValueColumn: data?.selectedValueColumn || '',
      generatedStyle: data?.generatedStyle,
    };
    
    return entity;
  }

  async getEntity(nodeId: NodeId): Promise<StylerEntity | undefined> {
    const baseEntity = await this.spreadsheetHandler.getEntity(nodeId);
    if (!baseEntity) {
      return undefined;
    }
    
    // Extend with Styler fields
    const entity: StylerEntity = {
      ...baseEntity,
      stylerConfig: baseEntity.stylerConfig || StylerConfigDefault,
      selectedKeyColumn: baseEntity.selectedKeyColumn || '',
      selectedValueColumn: baseEntity.selectedValueColumn || '',
      generatedStyle: baseEntity.generatedStyle,
    };
    
    return entity;
  }

  async updateEntity(nodeId: NodeId, data: Partial<StylerEntity>): Promise<void> {
    // Update base spreadsheet entity
    await this.spreadsheetHandler.updateEntity(nodeId, data);
    
    // Generate style if needed
    if (data.stylerConfig || data.selectedKeyColumn || data.selectedValueColumn) {
      const currentEntity = await this.getEntity(nodeId);
      if (currentEntity && data.spreadsheetMetadataId && currentEntity.stylerConfig.targetProperty) {
        try {
          await this.dataService.generateMapLibreStyle(
            data.spreadsheetMetadataId,
            currentEntity
          );
          // Note: In a real implementation, we would save this to storage
        } catch (styleError) {
          console.warn('Failed to generate style:', styleError);
        }
      }
    }
  }

  async deleteEntity(nodeId: NodeId): Promise<void> {
    await this.spreadsheetHandler.deleteEntity(nodeId);
  }

  async createWorkingCopy(nodeId: NodeId): Promise<StylerWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error('Entity not found');
    }
    
    const workingCopy: StylerWorkingCopy = {
      ...entity,
      isDraft: true,
      copiedAt: Date.now(),
    };
    
    return workingCopy;
  }

  async commitWorkingCopy(nodeId: NodeId, workingCopy: StylerWorkingCopy): Promise<void> {
    // Remove working copy properties
    const { isDraft, copiedAt, ...entityData } = workingCopy;
    await this.updateEntity(nodeId, entityData);
  }

  async discardWorkingCopy(_nodeId: NodeId): Promise<void> {
    // No-op: working copy is ephemeral
  }
}
