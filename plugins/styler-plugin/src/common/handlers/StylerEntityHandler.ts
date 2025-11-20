/**
 * @file StylerEntityHandler.ts
 * @description Styler entity handler extending Spreadsheet functionality
 */

import type { NodeId } from '@hierarchidb/common-types';
import type { StylerDataService } from '../../services/StylerDataService.js';
// Note: Do not implement the shared EntityHandler interface here because this handler returns
// operation-result shapes used by tests. Build-time typing is kept local to avoid signature clashes.
import type { StylerEntity } from '../types/StylerEntity.js';
import { StylerConfigDefault } from '../types/stylerTypes.js';

// Type for base handler (since SpreadsheetEntityHandler is not exported)
type HandlerPayload<T> =
  | T
  | { data: T }
  | { success: true; data: T }
  | { success: boolean; data: T };

type HandlerResult<T> = HandlerPayload<T> | { success: false } | null | undefined;

interface BaseEntityHandler {
  createEntity(nodeId: NodeId, data?: Partial<StylerEntity>): Promise<HandlerResult<StylerEntity>>;

  getEntity(nodeId: NodeId): Promise<HandlerResult<StylerEntity>>;

  updateEntity(nodeId: NodeId, data: Partial<StylerEntity>): Promise<HandlerResult<StylerEntity>>;

  deleteEntity(
    nodeId: NodeId,
    data?: Partial<StylerEntity>
  ): Promise<HandlerResult<StylerEntity> | undefined>;
}

function hasData<T>(value: unknown): value is { data: T } {
  return (
    typeof value === 'object' && value !== null && 'data' in (value as Record<string, unknown>)
  );
}

function unwrapHandlerResult<T>(result: HandlerResult<T>): T | undefined {
  if (!result) return undefined;
  if (hasData<T>(result)) {
    return result.data;
  }
  if (
    typeof result === 'object' &&
    result !== null &&
    'success' in (result as Record<string, unknown>) &&
    (result as { success: boolean }).success === false
  ) {
    return undefined;
  }
  return result as T;
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

  async createEntity(
    nodeId: NodeId,
    data?: Partial<StylerEntity>
  ): Promise<{ success: true; data: StylerEntity }> {
    // Create base spreadsheet entity (result or raw)
    const base = await this.spreadsheetHandler.createEntity(nodeId, data);
    const baseEntity = unwrapHandlerResult(base);
    if (!baseEntity) {
      throw new Error('Spreadsheet handler returned no entity during createEntity');
    }

    const entity: StylerEntity = {
      ...baseEntity,
      // Prefer requested name if provided
      stylerConfig: data?.stylerConfig || StylerConfigDefault,
      selectedKeyColumn: data?.selectedKeyColumn || '',
      selectedValueColumn: data?.selectedValueColumn || '',
      generatedStyle: data?.generatedStyle,
    };

    return { success: true, data: entity };
  }

  async getEntity(nodeId: NodeId): Promise<{ success: boolean; data?: StylerEntity }> {
    const base = await this.spreadsheetHandler.getEntity(nodeId);
    const baseEntity = unwrapHandlerResult(base);
    if (!baseEntity) return { success: false };

    const entity: StylerEntity = {
      ...baseEntity,
      stylerConfig: baseEntity.stylerConfig || StylerConfigDefault,
      selectedKeyColumn: baseEntity.selectedKeyColumn || '',
      selectedValueColumn: baseEntity.selectedValueColumn || '',
      generatedStyle: baseEntity.generatedStyle,
    };

    return { success: true, data: entity };
  }

  async updateEntity(
    nodeId: NodeId,
    data: Partial<StylerEntity>
  ): Promise<{ success: boolean; data?: StylerEntity }> {
    const updated = await this.spreadsheetHandler.updateEntity(nodeId, data);
    const updatedEntity = unwrapHandlerResult(updated);
    const baseEntity =
      updatedEntity ?? unwrapHandlerResult(await this.spreadsheetHandler.getEntity(nodeId));

    let entity: StylerEntity | undefined;
    if (baseEntity) {
      entity = {
        ...baseEntity,
        stylerConfig: baseEntity.stylerConfig || data.stylerConfig || StylerConfigDefault,
        selectedKeyColumn: baseEntity.selectedKeyColumn || data.selectedKeyColumn || '',
        selectedValueColumn: baseEntity.selectedValueColumn || data.selectedValueColumn || '',
        generatedStyle: baseEntity.generatedStyle,
      };
    }

    if (
      (data.stylerConfig || data.selectedKeyColumn || data.selectedValueColumn) &&
      entity &&
      data.spreadsheetMetadataId &&
      entity.stylerConfig.targetProperty
    ) {
      try {
        const { styleSpec, colorMapping } = await this.dataService.generateMapLibreStyle(
          data.spreadsheetMetadataId,
          entity
        );
        entity.generatedStyle = {
          maplibreStyleSpec: styleSpec,
          colorMapping,
          lastUpdated: Date.now(),
        };
      } catch (styleError) {
        console.warn('Failed to generate style:', styleError);
      }
    }

    return { success: !!entity, data: entity };
  }

  async deleteEntity(nodeId: NodeId): Promise<{ success: boolean }> {
    // Try to cleanup CSV table reference if present
    const existing = await this.spreadsheetHandler.getEntity(nodeId);
    const baseEntity = unwrapHandlerResult(existing);
    const tableId = baseEntity?.spreadsheetMetadataId;
    if (tableId) {
      try {
        await this.dataService.removeTableReference(tableId);
      } catch {
        /* ignore */
      }
    }
    await this.spreadsheetHandler.deleteEntity(nodeId);
    return { success: true };
  }

}
