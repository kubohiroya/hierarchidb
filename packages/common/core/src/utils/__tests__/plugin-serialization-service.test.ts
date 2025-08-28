/**
 * @file plugin-serialization-service.test.ts
 * @description TDD tests for centralized PluginEntitySerializer
 */

import { describe, it, expect } from 'vitest';
import { PluginEntitySerializer } from '../plugin-serializer';

describe('PluginEntitySerializer', () => {
  describe('serializeEntityArray', () => {
    it('$1', () => {
      // Arrange
      const entities = [
        {
          id: 'basemap-1',
          nodeId: 'node-123',
          name: 'Tokyo Map',
          mapStyle: { style: 'streets' },
          viewport: { center: [139.69, 35.68], zoom: 10, bearing: 0, pitch: 0 }
        }
      ];

      // Act
      const result = PluginEntitySerializer.serializeEntityArray(entities);

      // Assert
      expect(result.jsonArray).toHaveLength(1);
      expect(result.jsonArray[0]).toEqual(entities[0]);
      expect(result.binaryData.size).toBe(0);
      expect(result.binaryFilenames.size).toBe(0);
    });

    it('$1', () => {
      // Arrange
      const entities = [
        {
          tileId: 'tile-123',
          nodeId: 'node-456',
          z: 10, x: 512, y: 256,
          data_Uint8Array: new Uint8Array([1, 2, 3, 4, 5]),
          size: 5,
          features: 10
        }
      ];

      // Act
      const result = PluginEntitySerializer.serializeEntityArray(entities);

      // Assert
      expect(result.jsonArray).toHaveLength(1);
      expect(typeof result.jsonArray[0].data_Uint8Array).toBe('string'); // Should be UUID
      expect(result.binaryData.size).toBe(1);
      expect(result.binaryFilenames.size).toBe(1);
      
      // Check UUID reference is valid
      const uuid = result.jsonArray[0].data_Uint8Array;
      expect(result.binaryData.has(uuid)).toBe(true);
      expect(result.binaryFilenames.has(uuid)).toBe(true);
      expect(result.binaryFilenames.get(uuid)).toMatch(/^data_.*\.bin$/);
    });
  });

  describe('deserializeEntityArray', () => {
    it('$1', () => {
      // Arrange
      const jsonArray = [
        {
          id: 'folder-plugin-1',
          nodeId: 'node-123',
          name: 'My Documents',
          settings: { allowNestedFolders: true, maxDepth: 10, sortOrder: 'name' }
        }
      ];
      const binaryData = new Map<string, Uint8Array>();

      // Act
      const result = PluginEntitySerializer.deserializeEntityArray(jsonArray, binaryData);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(jsonArray[0]);
    });

    it('$1', () => {
      // Arrange - Simulate serialized data
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const uuid = crypto.randomUUID();
      
      const jsonArray = [
        {
          tileId: 'tile-123',
          nodeId: 'node-456',
          z: 10, x: 512, y: 256,
          data_Uint8Array: uuid, // UUID reference
          size: 5,
          features: 10
        }
      ];
      const binaryData = new Map<string, Uint8Array>();
      binaryData.set(uuid, originalData);

      // Act
      const result = PluginEntitySerializer.deserializeEntityArray(jsonArray, binaryData);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].data_Uint8Array).toBeInstanceOf(Uint8Array);
      expect(Array.from(result[0].data_Uint8Array)).toEqual([1, 2, 3, 4, 5]);
      expect(result[0].tileId).toBe('tile-123');
    });

    it('$1', () => {
      // Arrange - Original entity with Uint8Array
      const originalEntities = [
        {
          tileId: 'tile-roundtrip',
          nodeId: 'node-roundtrip',
          z: 15, x: 1024, y: 512,
          data_Uint8Array: new Uint8Array([10, 20, 30, 40, 50, 255, 128]),
          size: 7,
          features: 25,
          metadata: {
            nested: {
              anotherData_Uint8Array: new Uint8Array([100, 200])
            }
          }
        }
      ];

      // Act - Serialize then deserialize
      const serialized = PluginEntitySerializer.serializeEntityArray(originalEntities);
      const restored = PluginEntitySerializer.deserializeEntityArray(
        serialized.jsonArray, 
        serialized.binaryData
      );

      // Assert - Should match original data exactly
      expect(restored).toHaveLength(1);
      expect(restored[0].tileId).toBe('tile-roundtrip');
      expect(restored[0].nodeId).toBe('node-roundtrip');
      expect(restored[0].z).toBe(15);
      
      // Check main Uint8Array restoration
      expect(restored[0].data_Uint8Array).toBeInstanceOf(Uint8Array);
      expect(Array.from(restored[0].data_Uint8Array)).toEqual([10, 20, 30, 40, 50, 255, 128]);
      
      // Check nested Uint8Array restoration
      expect(restored[0].metadata.nested.anotherData_Uint8Array).toBeInstanceOf(Uint8Array);
      expect(Array.from(restored[0].metadata.nested.anotherData_Uint8Array)).toEqual([100, 200]);
    });
  });

  describe('edge cases', () => {
    it('$1', () => {
      const result = PluginEntitySerializer.serializeEntityArray([]);
      
      expect(result.jsonArray).toEqual([]);
      expect(result.binaryData.size).toBe(0);
      expect(result.binaryFilenames.size).toBe(0);
    });

    it('$1', () => {
      const entities = [
        {
          id: 'test-1',
          nullValue: null,
          undefinedValue: undefined,
          emptyString: '',
          zeroNumber: 0,
          falseBoolean: false
        }
      ];

      const serialized = PluginEntitySerializer.serializeEntityArray(entities);
      const restored = PluginEntitySerializer.deserializeEntityArray(serialized.jsonArray, serialized.binaryData);

      expect(restored[0].nullValue).toBeNull();
      expect(restored[0].emptyString).toBe('');
      expect(restored[0].zeroNumber).toBe(0);
      expect(restored[0].falseBoolean).toBe(false);
      // undefined values are preserved in our implementation
      expect(restored[0].undefinedValue).toBeUndefined();
    });

    it('$1', () => {
      const entities = [
        {
          id: 'empty-data',
          emptyData_Uint8Array: new Uint8Array([]),
          normalData_Uint8Array: new Uint8Array([1, 2, 3])
        }
      ];

      const serialized = PluginEntitySerializer.serializeEntityArray(entities);
      const restored = PluginEntitySerializer.deserializeEntityArray(serialized.jsonArray, serialized.binaryData);

      expect(restored[0].emptyData_Uint8Array).toBeInstanceOf(Uint8Array);
      expect(restored[0].emptyData_Uint8Array.length).toBe(0);
      expect(Array.from(restored[0].normalData_Uint8Array)).toEqual([1, 2, 3]);
      expect(serialized.binaryData.size).toBe(2); // Both arrays stored
    });

    it('$1', () => {
      const jsonArray = [
        {
          id: 'missing-binary',
          data_Uint8Array: 'non-existent-uuid'
        }
      ];
      const emptyBinaryData = new Map<string, Uint8Array>();

      const restored = PluginEntitySerializer.deserializeEntityArray(jsonArray, emptyBinaryData);

      // Should keep the UUID reference when binary data is missing
      expect(restored[0].data_Uint8Array).toBe('non-existent-uuid');
    });
  });
});