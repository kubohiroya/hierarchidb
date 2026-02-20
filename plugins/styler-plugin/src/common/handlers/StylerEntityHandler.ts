/**
 * @file StylerEntityHandler.ts
 * @description Styler entity handler extending Spreadsheet functionality
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { StylerDataService } from '~/services/StylerDataService';
// Note: Do not implement the shared EntityHandler interface here because this handler returns
// operation-result shapes used by tests. Build-time typing is kept local to avoid signature clashes.
import {
  StylerConfigDefault,
  type StylerEntity,
  StylerMappingDefault,
} from '~/common/types/StylerEntity';

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
      keyColumn: data?.keyColumn ?? baseEntity.keyColumn,
      valueColumn: data?.valueColumn ?? baseEntity.valueColumn,
      // Prefer requested name if provided
      config: data?.config || StylerConfigDefault,
      mapping: {
        ...StylerMappingDefault,
        ...data?.mapping,
      },
      styleKeyValues: data?.styleKeyValues ?? baseEntity.styleKeyValues,
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
      keyColumn: baseEntity.keyColumn,
      valueColumn: baseEntity.valueColumn,
      config: baseEntity.config || StylerConfigDefault,
      mapping: {
        ...StylerMappingDefault,
        ...baseEntity.mapping,
      },
      styleKeyValues: baseEntity.styleKeyValues,
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
        keyColumn: data.keyColumn ?? baseEntity.keyColumn,
        valueColumn: data.valueColumn ?? baseEntity.valueColumn,
        config: baseEntity.config || StylerConfigDefault,
        mapping: {
          ...StylerMappingDefault,
          ...baseEntity.mapping,
        },
        styleKeyValues: data.styleKeyValues ?? baseEntity.styleKeyValues,
        generatedStyle: baseEntity.generatedStyle,
      };
    }

    const nextKey = entity?.keyColumn;
    const nextValue = entity?.valueColumn;
    const tableId = data.spreadsheetMetadataId ?? entity?.spreadsheetMetadataId;
    const shouldRegenerate =
      Boolean(entity && tableId) &&
      Boolean(data.config || data.mapping || data.keyColumn || data.valueColumn);

    if (shouldRegenerate && entity && tableId) {
      try {
        const { styleSpec, colorMapping } = await this.dataService.generateMapLibreStyle(tableId, {
          ...entity,
          keyColumn: nextKey,
          valueColumn: nextValue,
        });
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
