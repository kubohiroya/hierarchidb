/**
  * @file ShapeEntity.ts
 * @description ERIA-Cartograph: Shape Entity
  */

import type { NodeId } from '@hierarchidb/common-type';
import type { DataSourceName } from '@hierarchidb/runtime-ui-datasource';
import type { BatchConfig } from './BatchConfig.js';

/**
 * Shape entity stored in CoreDB
 */
export interface ShapeEntity {
  id: NodeId;
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
