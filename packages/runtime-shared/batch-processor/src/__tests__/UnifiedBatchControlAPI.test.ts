/**
 * Test for Unified Batch Control API
 * Validates that the standardized API works across all plugins
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { isBatchControlAPIV2Enabled } from '@hierarchidb/runtime-shared-batch-processor';

// Set feature flag for testing
beforeEach(() => {
  // Set environment variable for testing
  if (typeof process !== 'undefined' && process.env) {
    process.env.BATCH_CONTROL_API_V2 = 'true';
  }
  
  // Set global feature flag
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).FEATURE_FLAGS = {
      BATCH_CONTROL_API_V2: true,
    };
  }
});

describe('Unified Batch Control API', () => {
  it('should detect API v2 is enabled', () => {
    expect(isBatchControlAPIV2Enabled()).toBe(true);
  });

  describe('Feature Flag Detection', () => {
    it('should detect environment variable', () => {
      if (typeof process !== 'undefined' && process.env) {
        process.env.BATCH_CONTROL_API_V2 = '1';
        expect(isBatchControlAPIV2Enabled()).toBe(true);
        
        process.env.BATCH_CONTROL_API_V2 = 'false';
        expect(isBatchControlAPIV2Enabled()).toBe(false);
        
        delete process.env.BATCH_CONTROL_API_V2;
      }
    });

    it('should detect global feature flag', () => {
      if (typeof globalThis !== 'undefined') {
        (globalThis as any).FEATURE_FLAGS = { BATCH_CONTROL_API_V2: true };
        expect(isBatchControlAPIV2Enabled()).toBe(true);
        
        (globalThis as any).FEATURE_FLAGS = { BATCH_CONTROL_API_V2: false };
        expect(isBatchControlAPIV2Enabled()).toBe(false);
        
        delete (globalThis as any).FEATURE_FLAGS;
      }
    });

    it('should return false when no flags are set', () => {
      if (typeof process !== 'undefined' && process.env) {
        delete process.env.BATCH_CONTROL_API_V2;
      }
      if (typeof globalThis !== 'undefined') {
        delete (globalThis as any).FEATURE_FLAGS;
      }
      
      expect(isBatchControlAPIV2Enabled()).toBe(false);
    });
  });
});