/**
  * @file ShapePlugin.ts
 * @description ERIA-Cartograph: Shape Plugin
  */

import type { TreeNodeId } from '@hierarchidb/common-type';
import { BatchSessionManager } from './services/BatchSessionManager.js';
import type { BatchConfig } from './types/BatchConfig.js';

class InvalidCountryCodeError extends Error {
  constructor(message: string, public readonly invalidCodes: string[]) {
    super(message);
    this.name = 'InvalidCountryCodeError';
  }

  readonly type = 'INVALID_COUNTRY_CODE';
  readonly userFriendlyMessage = '指定された国コードが無効です。正しい ISO A2 コードを使用してください。';
  readonly recoverable = true;
}

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
      throw new InvalidCountryCodeError('Invalid country codes', invalidCountries);
    }

    return await this.batchSessionManager.startBatchSession(
      treeNodeId,
      config,
      countries,
      adminLevels,
    );
  }
}
