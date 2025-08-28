/**
 * @file ShapeEntity.ts
 * @description ERIA-Cartograph移植: Shape Entity型定義
 */

import type { NodeId, EntityId } from '@hierarchidb/core';
import type { DataSourceName } from '@hierarchidb/runtime-datasource';
import type { BatchConfig } from './BatchConfig';

/**
 * Shape entity stored in CoreDB
 */
export interface ShapeEntity {
  id: EntityId;
  nodeId: NodeId;
  dataSourceName: DataSourceName;
  selectedCountries: string[];
  selectedAdminLevels: number[];
  licenseAgreement: boolean;
  batchConfig?: BatchConfig;
  createdAt: number;
  updatedAt: number;
  version: number;
}

/**
 * Working copy for safe editing
 */
export interface ShapeWorkingCopy {
  nodeId: NodeId;
  baseVersion: number;
  isModified: boolean;
  changes: Partial<Omit<ShapeEntity, 'id' | 'nodeId' | 'createdAt' | 'version'>>;
}