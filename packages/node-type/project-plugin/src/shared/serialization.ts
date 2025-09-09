/**
 * Project plugin serialization utilities
 * - Deeply traverses objects
 * - Extracts binary values (Uint8Array/ArrayBuffer) to a Map keyed by UUID
 * - Replaces binary values in JSON with the UUID string reference
 */

export interface SerializationResult {
  jsonData: any;
  binaryData: Map<string, Uint8Array>;
  binaryFilenames: Map<string, string>;
}

export interface DeserializationInput {
  jsonData: any;
  binaryData: Map<string, Uint8Array>;
}

const BINARY_SUFFIX = '_Uint8Array';

export class ProjectEntitySerializer {
  static serialize(entity: any): SerializationResult {
    const binaryData = new Map<string, Uint8Array>();
    const binaryFilenames = new Map<string, string>();
    const jsonData = this.processForSerialization(entity, binaryData, binaryFilenames);
    return { jsonData, binaryData, binaryFilenames };
  }

  static deserialize(input: DeserializationInput): any {
    const { jsonData, binaryData } = input;
    return this.processForDeserialization(jsonData, binaryData);
  }

  static serializeEntityArray(entities: any[]): {
    jsonArray: any[];
    binaryData: Map<string, Uint8Array>;
    binaryFilenames: Map<string, string>;
  } {
    const jsonArray: any[] = [];
    const binaryData = new Map<string, Uint8Array>();
    const binaryFilenames = new Map<string, string>();
    for (const entity of entities) {
      const res = this.serialize(entity);
      jsonArray.push(res.jsonData);
      res.binaryData.forEach((v, k) => binaryData.set(k, v));
      res.binaryFilenames.forEach((v, k) => binaryFilenames.set(k, v));
    }
    return { jsonArray, binaryData, binaryFilenames };
  }

  static deserializeEntityArray(jsonArray: any[], binaryData: Map<string, Uint8Array>): any[] {
    return jsonArray.map((jsonData) => this.deserialize({ jsonData, binaryData }));
  }

  private static processForSerialization(
    obj: any,
    binaryData: Map<string, Uint8Array>,
    binaryFilenames: Map<string, string>,
    path: string[] = [],
  ): any {
    if (obj == null || typeof obj !== 'object') return obj;
    if (obj instanceof Uint8Array) {
      const uuid = crypto.randomUUID();
      binaryData.set(uuid, obj);
      binaryFilenames.set(uuid, `${path[path.length - 1] || 'binary'}_${uuid}.bin`);
      return uuid;
    }
    if (obj instanceof ArrayBuffer) {
      const uuid = crypto.randomUUID();
      const view = new Uint8Array(obj);
      binaryData.set(uuid, view);
      binaryFilenames.set(uuid, `${path[path.length - 1] || 'binary'}_${uuid}.bin`);
      return uuid;
    }
    if (Array.isArray(obj)) {
      return obj.map((item, i) => this.processForSerialization(item, binaryData, binaryFilenames, [...path, String(i)]));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // If property name follows _Uint8Array convention and value is Uint8Array/ArrayBuffer, prefer that name in filename
      const keyForName = key.endsWith(BINARY_SUFFIX) ? key.replace(BINARY_SUFFIX, '') : key;
      result[key] = this.processForSerialization(value as any, binaryData, binaryFilenames, [...path, keyForName]);
    }
    return result;
  }

  private static processForDeserialization(obj: any, binaryData: Map<string, Uint8Array>): any {
    if (obj == null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.processForDeserialization(item, binaryData));

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && binaryData.has(value)) {
        // Restore as Uint8Array when a UUID reference is present
        result[key] = binaryData.get(value);
      } else if (typeof value === 'object') {
        result[key] = this.processForDeserialization(value, binaryData);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}

