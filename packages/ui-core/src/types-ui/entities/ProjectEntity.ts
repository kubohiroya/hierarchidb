/**
 * @file ProjectEntity.ts
 * @description Re-export of ProjectEntity from the domains package
 */

// Re-export the actual ProjectEntity from the domains package
// ProjectEntity is now just a TreeEntity with project-specific properties
import type { TreeEntity } from './TreeEntity';

export interface ProjectEntity extends TreeEntity {
  // Add project-specific properties if needed
}
