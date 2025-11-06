/**
 * @file LocationPoint.ts
 * @description Persistent GroupEntity representing a single location point that belongs to a TreeNode.
 */

import type { GroupEntity, NodeId, Timestamp } from '@hierarchidb/common-types';

export interface LocationPointSource {
  provider: string;
  fetchedAt: Timestamp;
  originalId?: string;
}

export type LocationPointKind = string;

export interface LocationPointProperties<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  schemaVersion: 1;
  /** Vector tile PID; also used for cross-plugin joins. */
  pid: string;
  /** Human-readable name. */
  name: string;
  /** WGS84 coordinates. */
  latitude: number;
  longitude: number;
  /** Domain-specific classification (poi, hospital, etc.). */
  kind: LocationPointKind;
  /** Administrative identifiers aligned with vector tiles. */
  gid0: string;
  gid1?: string;
  gid2?: string;
  /** Additional attributes mirrored to vector-tile features properties. */
  payload: TPayload;
  /** Acquisition metadata. */
  source?: LocationPointSource;
}

export interface LocationPoint<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> extends GroupEntity<string>, LocationPointProperties<TPayload> {
  /** TreeNode to which this point belongs. */
  nodeId: NodeId;
  /** GroupEntity discriminator. */
  type: 'locationPoint';
}

export type LocationPointId = LocationPoint['id'];
