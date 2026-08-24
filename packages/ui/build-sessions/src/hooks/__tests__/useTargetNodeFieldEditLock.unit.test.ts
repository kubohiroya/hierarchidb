import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import { resolveBuildSessionFieldEditLock } from '../resolveBuildSessionFieldEditLock.js';
import type { BuildSessionSnapshot } from '../useBuildSessionSnapshots.js';

const activeSession: BuildSessionSnapshot = {
  nodeId: 'node-1' as NodeId,
  status: 'running',
  isActive: true,
  revision: 1,
};

describe('resolveBuildSessionFieldEditLock', () => {
  it('locks explicitly listed fields during an active session', () => {
    expect(
      resolveBuildSessionFieldEditLock({
        fieldId: 'metadata.name',
        lockedFieldIds: ['metadata.name'],
        session: activeSession,
      })
    ).toMatchObject({
      locked: true,
      reason: 'This field is locked while a canonical build session is queued or running.',
      sessionNodeId: 'node-1',
      sessionStatus: 'running',
    });
  });

  it('keeps unlisted fields editable during an active session', () => {
    expect(
      resolveBuildSessionFieldEditLock({
        fieldId: 'metadata.description',
        lockedFieldIds: ['metadata.name'],
        session: activeSession,
      })
    ).toEqual({
      locked: false,
      sessionNodeId: 'node-1',
      sessionStatus: 'running',
    });
  });

  it('keeps listed fields editable when the session is not active', () => {
    expect(
      resolveBuildSessionFieldEditLock({
        fieldId: 'metadata.name',
        lockedFieldIds: ['metadata.name'],
        session: { ...activeSession, status: 'paused', isActive: false },
      })
    ).toEqual({ locked: false });
  });

  it('rejects empty field ids instead of silently allowing edits', () => {
    expect(() =>
      resolveBuildSessionFieldEditLock({
        fieldId: '',
        lockedFieldIds: ['metadata.name'],
        session: activeSession,
      })
    ).toThrow('fieldId must be a non-empty field id.');
    expect(() =>
      resolveBuildSessionFieldEditLock({
        fieldId: 'metadata.name',
        lockedFieldIds: [''],
        session: activeSession,
      })
    ).toThrow('lockedFieldId must be a non-empty field id.');
  });
});
