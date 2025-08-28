/**
 * @file plugin-serializer.ts
 * @description Plugin entity serialization utilities with Uint8Array handling
 */

import { DeserializationInput, SerializationResult } from '@hierarchidb/common-type';

/**
 * Plugin Entity Serializer
 * Handles JSON serialization with special Uint8Array handling
 */
/**
 * Plugin Entity Serializer
 * Handles JSON serialization with _Uint8Array suffix convention
 */
export class PluginEntitySerializer {
  private static readonly UINT8_ARRAY_SUFFIX = '_Uint8Array';

  /**
   * Serialize entity with _Uint8Array suffix handling
   */
  static serialize(entity: any): SerializationResult {
    const binaryData = new Map<string, Uint8Array>();
    const binaryFilenames = new Map<string, string>();

    // Deep clone and process entity
    const jsonData = this.processObjectForSerialization(entity, binaryData, binaryFilenames);

    return {
      jsonData,
      binaryData,
      binaryFilenames,
    };
  }

  /**
   * Deserialize entity with binary data restoration
   */
  static deserialize(input: DeserializationInput): any {
    const { jsonData, binaryData } = input;

    return this.processObjectForDeserialization(jsonData, binaryData);
  }

  /**
   * Process object for serialization (recursive)
   */
  private static processObjectForSerialization(
    obj: any,
    binaryData: Map<string, Uint8Array>,
    binaryFilenames: Map<string, string>
  ): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) =>
        this.processObjectForSerialization(item, binaryData, binaryFilenames)
      );
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key.endsWith(this.UINT8_ARRAY_SUFFIX) && value instanceof Uint8Array) {
        // Generate UUID for Uint8Array
        const uuid = crypto.randomUUID();
        const basePropertyName = key.replace(this.UINT8_ARRAY_SUFFIX, '');
        const filename = `${basePropertyName}_${uuid}.bin`;

        binaryData.set(uuid, value);
        binaryFilenames.set(uuid, filename);
        result[key] = uuid; // Store UUID reference
      } else if (typeof value === 'object') {
        result[key] = this.processObjectForSerialization(value, binaryData, binaryFilenames);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Process object for deserialization (recursive)
   */
  private static processObjectForDeserialization(
    obj: any,
    binaryData: Map<string, Uint8Array>
  ): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.processObjectForDeserialization(item, binaryData));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (
        key.endsWith(this.UINT8_ARRAY_SUFFIX) &&
        typeof value === 'string' &&
        binaryData.has(value)
      ) {
        // Restore Uint8Array from UUID reference
        result[key] = binaryData.get(value);
      } else if (typeof value === 'object') {
        result[key] = this.processObjectForDeserialization(value, binaryData);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Serialize array of entities
   */
  static serializeEntityArray(entities: any[]): {
    jsonArray: any[];
    binaryData: Map<string, Uint8Array>;
    binaryFilenames: Map<string, string>;
  } {
    const jsonArray: any[] = [];
    const binaryData = new Map<string, Uint8Array>();
    const binaryFilenames = new Map<string, string>();

    entities.forEach((entity) => {
      const result = this.serialize(entity);
      jsonArray.push(result.jsonData);

      // Merge binary data
      result.binaryData.forEach((data, uuid) => {
        binaryData.set(uuid, data);
      });
      result.binaryFilenames.forEach((filename, uuid) => {
        binaryFilenames.set(uuid, filename);
      });
    });

    return { jsonArray, binaryData, binaryFilenames };
  }

  /**
   * Deserialize array of entities
   */
  static deserializeEntityArray(jsonArray: any[], binaryData: Map<string, Uint8Array>): any[] {
    return jsonArray.map((jsonData) => this.deserialize({ jsonData, binaryData }));
  }

  /**
   * Check if property name follows _Uint8Array convention
   */
  static isUint8ArrayProperty(propertyName: string): boolean {
    return propertyName.endsWith(this.UINT8_ARRAY_SUFFIX);
  }

  /**
   * Get base property name without _Uint8Array suffix
   */
  static getBasePropertyName(propertyName: string): string {
    if (this.isUint8ArrayProperty(propertyName)) {
      return propertyName.replace(this.UINT8_ARRAY_SUFFIX, '');
    }
    return propertyName;
  }

  /**
   * Calculate total binary data size
   */
  static calculateBinaryDataSize(binaryData: Map<string, Uint8Array>): number {
    let totalSize = 0;
    binaryData.forEach((data) => {
      totalSize += data.byteLength;
    });
    return totalSize;
  }

  /**
   * Get binary data statistics
   */
  static getBinaryDataStats(binaryData: Map<string, Uint8Array>): {
    count: number;
    totalSize: number;
    averageSize: number;
    minSize: number;
    maxSize: number;
  } {
    if (binaryData.size === 0) {
      return { count: 0, totalSize: 0, averageSize: 0, minSize: 0, maxSize: 0 };
    }

    const sizes = Array.from(binaryData.values()).map((data) => data.byteLength);
    const totalSize = sizes.reduce((sum, size) => sum + size, 0);

    return {
      count: binaryData.size,
      totalSize,
      averageSize: Math.round(totalSize / binaryData.size),
      minSize: Math.min(...sizes),
      maxSize: Math.max(...sizes),
    };
  }
}
