/**
 * Integration test for unified batch managers
 * Tests that all plugin managers implement the same interface correctly
 */

import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

describe('Unified Batch Manager Integration', () => {
  it('should have unified interface signatures', () => {
    // Test that we can import the factory functions
    expect(() => {
      // These imports will validate that the interfaces are correctly defined
      const { createLocationBatchManager } = require('@hierarchidb/node-type-location-plugin');
      const { createShapeBatchManager } = require('@hierarchidb/node-type-shape-plugin');
      const { createRouteBatchManager } = require('@hierarchidb/node-type-route-plugin');

      // Check that factory functions exist
      expect(typeof createLocationBatchManager).toBe('function');
      expect(typeof createShapeBatchManager).toBe('function');
      expect(typeof createRouteBatchManager).toBe('function');

    }).not.toThrow();
  });

  it('should create managers with unified interface', async () => {
    // This test verifies that all managers implement IBatchSessionManager
    const { createLocationBatchManager } = await import('@hierarchidb/node-type-location-plugin');
    const { createShapeBatchManager } = await import('@hierarchidb/node-type-shape-plugin');
    const { createRouteBatchManager } = await import('@hierarchidb/node-type-route-plugin');

    const locationManager = createLocationBatchManager();
    const shapeManager = createShapeBatchManager();
    const routeManager = createRouteBatchManager();

    // Check that all managers have the same interface methods
    const requiredMethods = [
      'startBatchSession',
      'pauseBatchSession',
      'resumeBatchSession',
      'cancelBatchSession',
      'getBatchSessionStatus',
      'onBatchProgress',
    ];

    for (const method of requiredMethods) {
      expect(typeof (locationManager as any)[method]).toBe('function');
      expect(typeof (shapeManager as any)[method]).toBe('function');
      expect(typeof (routeManager as any)[method]).toBe('function');
    }
  });
});

describe('Feature Flag Integration', () => {
  it('should detect feature flag correctly across plugins', async () => {
    const { isLocationBatchAPIV2Enabled } = await import('@hierarchidb/node-type-location-plugin');
    const { isShapeBatchAPIV2Enabled } = await import('@hierarchidb/node-type-shape-plugin');
    const { isRouteBatchAPIV2Enabled } = await import('@hierarchidb/node-type-route-plugin');

    expect(isLocationBatchAPIV2Enabled()).toBe(true);
    expect(isShapeBatchAPIV2Enabled()).toBe(true);
    expect(isRouteBatchAPIV2Enabled()).toBe(true);
  });
});
