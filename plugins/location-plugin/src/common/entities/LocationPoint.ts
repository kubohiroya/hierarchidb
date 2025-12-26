/**
 * @file LocationPoint.ts
 * @description Persistent GroupEntity representing a single location point that belongs to a TreeNode.
 */

import type { GroupEntity, Timestamp, NodeId } from '@hierarchidb/common-types';
import type { LocationType } from './LocationEntity.js';

export interface LocationPointSource {
  provider: string;
  fetchedAt: Timestamp;
  originalId?: string;
}

export type LocationPointKind = LocationType | string;

export type LocationPointMetadata = Record<string, string | number | null>;

export interface LocationPointProperties {
  schemaVersion: 2;
  /** Vector tile PID; also used for cross-plugin joins. */
  pid: string;
  /** Human-readable name. */
  name: string;
  /** WGS84 coordinates. */
  latitude: number;
  longitude: number;
  /** Domain-specific classification (poi, hospital, etc.). */
  kind: LocationPointKind;
  /** ISO country code (alpha-2). */
  countryCode: string;
  /** Optional country name for metadata preview. */
  countryName?: string;
  /** Optional admin-level labels. */
  admin1?: string;
  admin2?: string;
  /** Additional attributes captured as flat metadata. */
  metadata?: LocationPointMetadata;
  /** Acquisition metadata. */
  source?: LocationPointSource;
}

export interface LocationPoint extends GroupEntity<string>, LocationPointProperties {
  /** TreeNode to which this point belongs. */
  nodeId: NodeId;
  /** GroupEntity discriminator. */
  type: 'locationPoint';
}

export type LocationPointId = LocationPoint['id'];
