/**
 * Location worker entity-specific data structures used by Dexie stores.
 */

export interface LocationPeerData {
  schemaVersion: 1;
  lastProgress?: {
    stage: string;
    completed?: number;
    total?: number;
    updatedAt?: number;
  };
  lastError?: {
    message: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface LocationGroupItemData {
  schemaVersion: 1;
  label?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface LocationRelationMeta {
  schemaVersion: 1;
  relationKind?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

