import type { Timestamp } from '@hierarchidb/common-types';

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
  pid: string;
  name: string;
  latitude: number;
  longitude: number;
  kind: LocationPointKind;
  gid0: string;
  gid1?: string;
  gid2?: string;
  payload: TPayload;
  source?: LocationPointSource;
}

export interface LocationGroupItemData<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> extends LocationPointProperties<TPayload> {}

export interface LocationRelationMeta {
  schemaVersion: 1;
  relationKind?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}
