/**
 * @file plugin-serialization.ts
 * @description Plugin serialization metadata types
 */

/**
 * Binary property configuration for custom serialization
 */
export interface BinaryPropertyConfig {
  /** Database table name */
  tableName: string;
  /** Property name containing Uint8Array data */
  propertyName: string;
  /** File extension for binary files (e.g., 'bin', 'pbf', 'mvt') */
  fileExtension?: string;
  /** Description of the binary data type */
  description?: string;
}

/**
 * Custom serialization configuration for plugin
 */
export interface PluginSerializationConfig {
  /** Database name for the plugin */
  databaseName: string;
  /** List of binary properties that need special handling */
  binaryProperties: BinaryPropertyConfig[];
}

/**
 * Extended plugin definition with serialization metadata
 */
export interface PluginDefinitionWithSerialization {
  nodeType: string;
  name?: string;
  version?: string;
  database: {
    entityStore: string;
    schema: any;
    version: number;
  };
  entityHandler: any;
  lifecycle?: any;
  ui?: any;
  category?: any;
  
  /** Custom serialization configuration */
  serialization?: PluginSerializationConfig;
}

/**
 * Serialization result with binary data separated
 */
export interface SerializationResult {
  /** JSON-serializable entity data with UUID references for binary data */
  jsonData: any;
  /** Map of UUID to binary data for separate file storage */
  binaryData: Map<string, Uint8Array>;
  /** Map of UUID to suggested filename (including extension) */
  binaryFilenames: Map<string, string>;
}

/**
 * Deserialization input with binary data references
 */
export interface DeserializationInput {
  /** JSON data with UUID references */
  jsonData: any;
  /** Map of UUID to binary data loaded from files */
  binaryData: Map<string, Uint8Array>;
}