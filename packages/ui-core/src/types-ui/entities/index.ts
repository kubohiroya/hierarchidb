/**
 * @file Entity types index
 * @module features/tree-data/types/entities
 */

// Core traits
export type { Timestamped } from './Timestamped';
export type { WorkingCopyProperties } from './TreeEntity';

// Base entity types
export type { ResourceEntity } from './ResourceEntity';

// Legacy TreeEntity (deprecated)
export type { TreeEntity } from './TreeEntity';
export {
  isTreeEntity,
  isWorkingCopy,
  createWorkingCopyFrom,
  stripWorkingCopyProperties,
} from './TreeEntity';
export type { PrimaryResourceEntity } from '../entities/PrimaryResourceEntity';
export type { SecondaryResourceEntity } from '../entities/SecondaryResourceEntity';

// TreeNodeId is exported from nodes/index.ts to avoid duplicate export
