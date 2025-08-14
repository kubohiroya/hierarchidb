/**
 * @file ProjectEntity.ts
 * @description Re-export of ProjectEntity from the domains package
 */

// Define ProjectEntity locally since domains/projects doesn't exist
import type { TreeEntity } from '../entities/TreeEntity';

export interface ProjectEntity extends TreeEntity {
  // Add project-specific properties if needed
}
