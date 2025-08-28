/**
 * @file StyleMapEntityHandler.ts
 * @description StyleMap entity handler extending Spreadsheet functionality
 */

import type { NodeId } from '@hierarchidb/common-core';
import type { EntityHandler, GroupEntity } from '@hierarchidb/common-core';
import type { StyleMapEntity, StyleMapWorkingCopy } from '../entities/StyleMapEntity';
import { StyleMapConfigDefault } from '../types/styleMapTypes';
import { StyleMapDataService } from '../services/StyleMapDataService';

// Type for base handler (since SpreadsheetEntityHandler is not exported)
interface BaseEntityHandler {
  createEntity(nodeId: NodeId, data: any): Promise<any>;
  getEntity(nodeId: NodeId): Promise<any>;
  updateEntity(nodeId: NodeId, data: any): Promise<any>;
  deleteEntity(nodeId: NodeId): Promise<any>;
}

/**
 * StyleMapEntityHandler
 * Extends SpreadsheetEntityHandler to add style map functionality
 */
export class StyleMapEntityHandler
  implements EntityHandler<StyleMapEntity, GroupEntity, StyleMapWorkingCopy>
{
  private spreadsheetHandler: BaseEntityHandler;
  private dataService: StyleMapDataService;

  constructor(spreadsheetHandler: BaseEntityHandler, dataService: StyleMapDataService) {
    this.spreadsheetHandler = spreadsheetHandler;
    this.dataService = dataService;
  }

  async createEntity(nodeId: NodeId, data?: Partial<StyleMapEntity>): Promise<StyleMapEntity> {
    // Create base spreadsheet entity
    const baseEntity = await this.spreadsheetHandler.createEntity(nodeId, data);
    
    // Extend with StyleMap fields
    const entity: StyleMapEntity = {
      ...baseEntity,
      styleMapConfig: data?.styleMapConfig || StyleMapConfigDefault,
      selectedKeyColumn: data?.selectedKeyColumn || '',
      selectedValueColumn: data?.selectedValueColumn || '',
      generatedStyle: data?.generatedStyle,
    };
    
    return entity;
  }

  async getEntity(nodeId: NodeId): Promise<StyleMapEntity | undefined> {
    const baseEntity = await this.spreadsheetHandler.getEntity(nodeId);
    if (!baseEntity) {
      return undefined;
    }
    
    // Extend with StyleMap fields
    const entity: StyleMapEntity = {
      ...baseEntity,
      styleMapConfig: baseEntity.styleMapConfig || StyleMapConfigDefault,
      selectedKeyColumn: baseEntity.selectedKeyColumn || '',
      selectedValueColumn: baseEntity.selectedValueColumn || '',
      generatedStyle: baseEntity.generatedStyle,
    };
    
    return entity;
  }

  async updateEntity(nodeId: NodeId, data: Partial<StyleMapEntity>): Promise<void> {
    // Update base spreadsheet entity
    await this.spreadsheetHandler.updateEntity(nodeId, data);
    
    // Generate style if needed
    if (data.styleMapConfig || data.selectedKeyColumn || data.selectedValueColumn) {
      const currentEntity = await this.getEntity(nodeId);
      if (currentEntity && data.spreadsheetMetadataId && currentEntity.styleMapConfig.targetProperty) {
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

  async createWorkingCopy(nodeId: NodeId): Promise<StyleMapWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error('Entity not found');
    }
    
    const workingCopy: StyleMapWorkingCopy = {
      ...entity,
      isDraft: true,
      copiedAt: Date.now(),
    };
    
    return workingCopy;
  }

  async commitWorkingCopy(nodeId: NodeId, workingCopy: StyleMapWorkingCopy): Promise<void> {
    // Remove working copy properties
    const { isDraft, copiedAt, ...entityData } = workingCopy;
    await this.updateEntity(nodeId, entityData);
  }

  async discardWorkingCopy(_nodeId: NodeId): Promise<void> {
    // No-op: working copy is ephemeral
  }
}