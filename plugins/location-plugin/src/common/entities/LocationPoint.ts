/**
 * @file LocationPoint.ts
 * @description Persistent GroupEntity representing a single location point that belongs to a TreeNode.
 */

import type { GroupEntity, NodeId } from '@hierarchidb/common-types';
import type { LocationType } from './LocationEntity.js';

export type LocationPointKind = LocationType | string;

export type LocationPointMetadata = Record<string, string | number | null>;

export type LocationPointId = string & { readonly __brand: 'LocationPointId' };

export interface LocationPointProperties {
  schemaVersion: 2;
  /** Stable point identifier for cross-plugin joins. */
  pointId: LocationPointId;
  /** Human-readable name. */
  name: string;
  /** WGS84 coordinates. */
  latitude: number;
  longitude: number;
  /** Domain-specific classification (poi, hospital, etc.). */
  kind: LocationPointKind;
  /** Optional country name for metadata preview. */
  countryName?: string;
  /** ISO country code (alpha-2). */
  countryCode: string;
  /** Optional admin-level labels. */
  admin1?: string;
  admin2?: string;
  admin1Code?: string;
  admin2Code?: string;
  /** Additional attributes captured as flat metadata. */
  metadata?: LocationPointMetadata;
}

export interface LocationPoint extends GroupEntity<LocationPointId>, LocationPointProperties {
  /** TreeNode to which this point belongs. */
  nodeId: NodeId;
  /** GroupEntity discriminator. */
  type: 'locationPoint';
}
