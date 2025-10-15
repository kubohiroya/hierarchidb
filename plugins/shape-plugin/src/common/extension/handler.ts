/**
 * @file handler.ts
 * @description Shape extension handler
 *
 * This handler extends the FolderEntityHandler to provide Shape-specific
 * functionality while inheriting basic folder-plugin operations.
 */

import type { BaseEntityExtension, NodeId } from '@hierarchidb/common-types';
import type { FolderEntity } from '@hierarchidb/folder-plugin';
import { FolderEntityHandler } from '@hierarchidb/folder-plugin';
import {
  DEFAULT_PROCESSING_CONFIG,
  mergeProcessingConfig,
} from '../shared/index.js';
import type {
  CreateShapeData,
  DataSourceName,
  ProcessingConfig,
  ShapeEntity,
} from '../shared/index.js';
import { ShapeEntityHandler as OriginalShapeEntityHandler } from '../worker/handlers/ShapeEntityHandler.js';

/**
 * ShapeEntityHandler that extends FolderEntityHandler
 * Combines folder-plugin functionality with Shape-specific operations
 */
export class ShapeExtensionHandler
  extends FolderEntityHandler
  implements BaseEntityExtension<FolderEntity, ShapeEntity> {
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
      const shapeEntity = await this.originalHandler.getEntityByNodeId(nodeId);
      if (!shapeEntity) {
        return {};
      }

      return {
        dataSourceName: shapeEntity.dataSourceName,
        selectedCountries: [...shapeEntity.selectedCountries],
        adminLevels: [...shapeEntity.adminLevels],
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
      const existingFolder = await super.getEntity(nodeId);
      const name = typeof data.name === 'string' && data.name.trim().length > 0
        ? data.name
        : existingFolder?.name ?? 'Untitled Shape Configuration';
      const description = typeof data.description === 'string'
        ? data.description
        : existingFolder?.description ?? '';
      const now = Date.now();

      if (existingFolder) {
        await super.updateEntity(nodeId, { name, description, updatedAt: now });
      } else {
        const folderPayload: Partial<FolderEntity> = { name, description };
        await super.createEntity(nodeId, folderPayload);
      }

      const existingShape = await this.originalHandler.getEntityByNodeId(nodeId);
      const resolvedDataSource = resolveDataSourceName(data.dataSourceName ?? existingShape?.dataSourceName);
      const resolvedProcessingConfig = resolveProcessingConfig(
        data.processingConfig ?? existingShape?.processingConfig ?? DEFAULT_PROCESSING_CONFIG,
      );
      const selectedCountries = Array.isArray(data.selectedCountries)
        ? data.selectedCountries.filter((country): country is string => typeof country === 'string')
        : existingShape?.selectedCountries ?? [];
      const adminLevels = Array.isArray(data.adminLevels)
        ? data.adminLevels.filter((level): level is number => Number.isInteger(level))
        : existingShape?.adminLevels ?? [];
      const urlMetadata = Array.isArray(data.urlMetadata) ? data.urlMetadata : existingShape?.urlMetadata ?? [];
      const checkboxState = resolveCheckboxState(data.checkboxState ?? existingShape?.checkboxState);
      const licenseAgreement =
        typeof data.licenseAgreement === 'boolean' ? data.licenseAgreement : existingShape?.licenseAgreement ?? false;

      if (existingShape) {
        const updatePayload: Partial<ShapeEntity> = {
          name,
          description,
          dataSourceName: resolvedDataSource,
          processingConfig: resolvedProcessingConfig,
          selectedCountries,
          adminLevels,
          urlMetadata,
          licenseAgreement,
        };
        if (checkboxState !== undefined) {
          updatePayload.checkboxState = checkboxState;
        }
        await this.originalHandler.updateEntity(existingShape.id, updatePayload);
      } else {
        const createPayload: CreateShapeData = {
          name,
          description,
          dataSourceName: resolvedDataSource,
          processingConfig: resolvedProcessingConfig,
          selectedCountries,
          adminLevels,
        };
        await this.originalHandler.createEntity(nodeId, createPayload);

        if (urlMetadata.length || checkboxState !== undefined || licenseAgreement || selectedCountries.length || adminLevels.length) {
          const createdShape = await this.originalHandler.getEntityByNodeId(nodeId);
          if (createdShape) {
            const updatePayload: Partial<ShapeEntity> = {
              urlMetadata,
              licenseAgreement,
              selectedCountries,
              adminLevels,
            };
            if (checkboxState !== undefined) {
              updatePayload.checkboxState = checkboxState;
            }
            await this.originalHandler.updateEntity(createdShape.id, updatePayload);
          }
        }
      }
    } catch (error) {
      console.error('Failed to save Shape extended data:', error);
      throw error;
    }
  }
}

const SUPPORTED_DATA_SOURCES: ReadonlyArray<DataSourceName> = [
  'naturalearth',
  'geoboundaries',
  'gadm',
  'openstreetmap',
];

function resolveDataSourceName(value: unknown): DataSourceName {
  return typeof value === 'string' && SUPPORTED_DATA_SOURCES.includes(value as DataSourceName)
    ? (value as DataSourceName)
    : 'naturalearth';
}

function resolveProcessingConfig(value: unknown): ProcessingConfig {
  if (value && typeof value === 'object') {
    return mergeProcessingConfig(value as Partial<ProcessingConfig>);
  }
  return DEFAULT_PROCESSING_CONFIG;
}

function resolveCheckboxState(value: unknown): boolean[][] | string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'boolean'))) {
    return value as boolean[][];
  }
  return undefined;
}
