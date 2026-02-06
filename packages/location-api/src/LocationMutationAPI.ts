import type { NodeId } from '@hierarchidb/core-types';
import type { LocationGroupItem, LocationRelation } from './LocationQueryAPI.js';
import type {
  IdeGsmImportCallback,
  IdeGsmLocationImportRequest,
  IdeGsmLocationImportResult,
} from './ideGsmTypes.js';

export interface LocationMutationAPI {
  upsertLocationGroups(nodeId: NodeId, items: LocationGroupItem[]): Promise<void>;
  deleteLocationGroups(nodeId: NodeId, itemIds: string[]): Promise<void>;
  upsertLocationRelations(relations: LocationRelation[]): Promise<void>;
  deleteLocationRelations(relations: LocationRelation[]): Promise<void>;
  clearLocationEntities(nodeId: NodeId): Promise<void>;
  clearLocationArtifacts(nodeId: NodeId): Promise<void>;
  deleteLocationBySourceKey(nodeId: NodeId, sourceKey: string): Promise<void>;
  migrateLegacyAdmin0(nodeId: NodeId): Promise<{ scanned: number; updated: number }>;
  importIdeGsmLocations(
    request: IdeGsmLocationImportRequest,
    progress?: IdeGsmImportCallback,
  ): Promise<IdeGsmLocationImportResult>;
}
