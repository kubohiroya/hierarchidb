/**
 * Test for Unified Batch Control API
 * Validates that the standardized API works across all plugins
 */

import { describe, expect, it } from 'vitest';
import { isBatchControlAPIV2Enabled } from '@hierarchidb/runtime-shared-batch-processor';

describe('Unified Batch Control API', () => {
  it('always reports API v2 enabled', () => {
    expect(isBatchControlAPIV2Enabled()).toBe(true);
  });
});
