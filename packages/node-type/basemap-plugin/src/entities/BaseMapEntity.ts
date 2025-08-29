/**
 * @file BaseMapEntity.ts
 * @description BaseMap entity definition following standard structure
 */

import type { PeerEntity, EntityId, NodeId } from '@hierarchidb/common-type';

export interface BaseMapEntity extends PeerEntity {
  id: EntityId;
  nodeId: NodeId;
  
  // Core baseMap properties
  styleUrl: string;
  stylePreset: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';
  
  // Viewport configuration
  center: [number, number]; // [longitude, latitude]
  zoom: number;
  bearing: number;
  pitch: number;
  
  // Display options
  showAttribution: boolean;
  showNavigation: boolean;
  enableInteraction: boolean;
  
  // Metadata
  name: string;
  description?: string;
  
  // Standard entity fields
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface BaseMapWorkingCopy extends BaseMapEntity {
  isDraft: boolean;
  originalId?: string;
  copiedAt: number;
}

// Extended fields for folder plugin extension
export interface BaseMapExtendedFields {
  styleUrl: string;
  stylePreset: string;
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  showAttribution: boolean;
  showNavigation: boolean;
  enableInteraction: boolean;
}