/**
 * @file plugin-serializer.test.ts
 * @description TDD tests for PluginEntitySerializer
 */

import { describe, it, expect } from 'vitest';
import { PluginEntitySerializer } from '../plugin-serializer';

describe('PluginEntitySerializer', () => {
  describe('isUint8ArrayProperty', () => {
    it('should return true for properties ending with _Uint8Array', () => {
      expect(PluginEntitySerializer.isUint8ArrayProperty('data_Uint8Array')).toBe(true);
      expect(PluginEntitySerializer.isUint8ArrayProperty('vectorTileData_Uint8Array')).toBe(true);
      expect(PluginEntitySerializer.isUint8ArrayProperty('binaryContent_Uint8Array')).toBe(true);
    });

    it('should return false for properties not ending with _Uint8Array', () => {
      expect(PluginEntitySerializer.isUint8ArrayProperty('data')).toBe(false);
      expect(PluginEntitySerializer.isUint8ArrayProperty('normalProperty')).toBe(false);
      expect(PluginEntitySerializer.isUint8ArrayProperty('someString')).toBe(false);
      expect(PluginEntitySerializer.isUint8ArrayProperty('')).toBe(false);
    });
  });
});