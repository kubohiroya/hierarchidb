/**
  * @file ShapePlugin.ts
 * @description ERIA-Cartograph: Shape Plugin
  */

import type { TreeNodeId } from '@hierarchidb/common-type';
import { BatchSessionManager } from './services/BatchSessionManager.js';
import type { BatchConfig } from './types/BatchConfig.js';

/**
 * Shape Plugin Main Class
 * Coordinates batch processing functionality
 */
export class ShapePlugin {
  private batchSessionManager = new BatchSessionManager();

  /**
   * Start batch processing
   */
  async startBatchProcessing(
    treeNodeId: TreeNodeId,
    config: BatchConfig,
    countries: string[],
    adminLevels: number[],
  ): Promise<string> {
    // Validate country codes
    const invalidCountries = countries.filter(country =>
      !country || country.length !== 3 || country.includes('INVALID'),
    );

    if (invalidCountries.length > 0) {
      const error = new Error('Invalid country codes') as any;
      error.type = 'INVALID_COUNTRY_CODE';
      error.invalidCodes = invalidCountries;
      error.userFriendlyMessage = '指定された国コードが無効です。正しい ISO A2 コードを使用してください。';
      error.recoverable = true;
      throw error;
    }

    return await this.batchSessionManager.startBatchSession(
      treeNodeId,
      config,
      countries,
      adminLevels,
    );
  }
}
