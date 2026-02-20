import { describe, expect, it } from 'vitest';
import type { RouteUpdaterPayload } from '@hierarchidb/route-api';
import type { NodeId } from '@hierarchidb/core-types';
import {
  getRouteUpdaterPayload,
  toRouteUpdaterPayload,
} from '../draft';

describe('route draft utilities', () => {
  it('returns only draftData from updater payload', () => {
    const entity = getRouteUpdaterPayload({
      treeNodeId: 'route-1',
      draftMetadata: { name: '', description: '', tags: [] },
      draftData: {
        tabularSourceId: 'tabular-1',
      },
    } as RouteUpdaterPayload);
    expect(entity.tabularSourceId).toBe('tabular-1');
  });

  it('does not fallback to top-level payload fields', () => {
    const entity = getRouteUpdaterPayload({
      treeNodeId: 'route-1',
      draftMetadata: { name: '', description: '', tags: [] },
      tabularSourceId: 'legacy-top-level',
    } as RouteUpdaterPayload);
    expect(entity.tabularSourceId).toBeUndefined();
  });

  it('normalizes empty payload into empty draftData', () => {
    const normalized = toRouteUpdaterPayload(null, 'route-1' as NodeId);
    expect(normalized.draftData).toEqual({});
  });
});
