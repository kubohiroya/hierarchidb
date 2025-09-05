/**
 * @file StylerEntityHandler.ts
 * @description Styler entity handler extending Spreadsheet functionality
 */

import type { NodeId } from '@hierarchidb/common-type';
// Note: Do not implement the shared EntityHandler interface here because this handler returns
// operation-result shapes used by tests. Build-time typing is kept local to avoid signature clashes.
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
export class StylerEntityHandler {
  private spreadsheetHandler: BaseEntityHandler;
  private dataService: StylerDataService;

  constructor(spreadsheetHandler: BaseEntityHandler, dataService: StylerDataService) {
    this.spreadsheetHandler = spreadsheetHandler;
    this.dataService = dataService;
  }

  async createEntity(nodeId: NodeId, data?: Partial<StylerEntity>): Promise<{ success: true; data: StylerEntity }> {
    // Create base spreadsheet entity (result or raw)
    const base = await this.spreadsheetHandler.createEntity(nodeId, data);
    const baseEntity = (base && 'data' in base) ? (base as any).data : base;

    const entity: StylerEntity = {
      ...baseEntity,
      // Prefer requested name if provided
      name: data?.name ?? baseEntity.name,
      stylerConfig: data?.stylerConfig || StylerConfigDefault,
      selectedKeyColumn: data?.selectedKeyColumn || '',
      selectedValueColumn: data?.selectedValueColumn || '',
      generatedStyle: data?.generatedStyle,
    } as StylerEntity;

    return { success: true, data: entity };
  }

  async getEntity(nodeId: NodeId): Promise<{ success: boolean; data?: StylerEntity }> {
    const base = await this.spreadsheetHandler.getEntity(nodeId);
    const baseEntity = base && 'data' in base ? (base as any).data : base;
    if (!baseEntity) return { success: false };

    const entity: StylerEntity = {
      ...baseEntity,
      stylerConfig: (baseEntity as any).stylerConfig || StylerConfigDefault,
      selectedKeyColumn: (baseEntity as any).selectedKeyColumn || '',
      selectedValueColumn: (baseEntity as any).selectedValueColumn || '',
      generatedStyle: (baseEntity as any).generatedStyle,
    } as StylerEntity;

    return { success: true, data: entity };
  }

  async updateEntity(nodeId: NodeId, data: Partial<StylerEntity>): Promise<{ success: boolean; data?: StylerEntity }> {
    const updated = await this.spreadsheetHandler.updateEntity(nodeId, data);
    const baseAfter = updated && 'data' in updated ? (updated as any).data : await this.spreadsheetHandler.getEntity(nodeId);
    const baseEntity = baseAfter && 'data' in (baseAfter as any) ? (baseAfter as any).data : baseAfter;

    let entity: StylerEntity | undefined;
    if (baseEntity) {
      entity = {
        ...baseEntity,
        stylerConfig: (baseEntity as any).stylerConfig || data.stylerConfig || StylerConfigDefault,
        selectedKeyColumn: (baseEntity as any).selectedKeyColumn || data.selectedKeyColumn || '',
        selectedValueColumn: (baseEntity as any).selectedValueColumn || data.selectedValueColumn || '',
        generatedStyle: (baseEntity as any).generatedStyle,
      } as StylerEntity;
    }

    if ((data.stylerConfig || data.selectedKeyColumn || data.selectedValueColumn) && entity && data.spreadsheetMetadataId && entity.stylerConfig.targetProperty) {
      try {
        const { styleSpec, colorMapping } = await this.dataService.generateMapLibreStyle(
          data.spreadsheetMetadataId,
          entity
        );
        entity.generatedStyle = {
          maplibreStyleSpec: styleSpec,
          colorMapping,
          lastUpdated: Date.now(),
        } as any;
      } catch (styleError) {
        console.warn('Failed to generate style:', styleError);
      }
    }

    return { success: !!entity, data: entity };
  }

  async deleteEntity(nodeId: NodeId): Promise<{ success: boolean }> {
    // Try to cleanup CSV table reference if present
    const existing = await this.spreadsheetHandler.getEntity(nodeId);
    const baseEntity = existing && 'data' in (existing as any) ? (existing as any).data : existing;
    const tableId = (baseEntity as any)?.spreadsheetMetadataId;
    if (tableId) {
      try { await this.dataService.removeTableReference(tableId); } catch { /* ignore */ }
    }
    await this.spreadsheetHandler.deleteEntity(nodeId);
    return { success: true };
  }

  async createWorkingCopy(nodeId: NodeId): Promise<StylerWorkingCopy> {
    const res = await this.getEntity(nodeId);
    if (!res.success || !res.data) throw new Error('Entity not found');
    const entity = res.data;

    const workingCopy: StylerWorkingCopy = {
      ...entity,
      isDraft: true,
      copiedAt: Date.now(),
    } as StylerWorkingCopy;

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
