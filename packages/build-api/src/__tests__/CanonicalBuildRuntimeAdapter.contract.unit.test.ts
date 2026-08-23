import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import {
  assertCanonicalBuildRuntimeRecord,
  type BuildSessionRuntimeRecord,
  CanonicalBuildRuntimeError,
  canonicalBuildSessionRuntimeStatuses,
  isBuildSessionRuntimeStatus,
} from '../index.js';

const nodeType = 'shape' as NodeType;

const createRuntimeRecord = (
  override: Partial<BuildSessionRuntimeRecord> = {}
): BuildSessionRuntimeRecord => ({
  nodeType,
  nodeId: 'node-1' as NodeId,
  status: 'running',
  isActive: true,
  revision: 1,
  ...override,
});

describe('CanonicalBuildRuntimeAdapter contract', () => {
  it('defines the supported runtime status set', () => {
    expect(canonicalBuildSessionRuntimeStatuses).toEqual([
      'idle',
      'starting',
      'running',
      'pausing',
      'paused',
      'resuming',
      'finalizing',
      'completed',
      'failed',
      'deleting',
    ]);
    expect(isBuildSessionRuntimeStatus('running')).toBe(true);
    expect(isBuildSessionRuntimeStatus('unknown')).toBe(false);
  });

  it('accepts a valid runtime record', () => {
    expect(assertCanonicalBuildRuntimeRecord(createRuntimeRecord(), nodeType)).toMatchObject({
      nodeType,
      nodeId: 'node-1',
      status: 'running',
    });
  });

  it('rejects status values outside the contract', () => {
    const record = createRuntimeRecord({
      status: 'unsupported' as BuildSessionRuntimeRecord['status'],
    });

    expect(() => assertCanonicalBuildRuntimeRecord(record, nodeType)).toThrow(
      CanonicalBuildRuntimeError
    );
  });

  it('rejects mismatched node types', () => {
    const record = createRuntimeRecord({ nodeType: 'location' as NodeType });

    expect(() => assertCanonicalBuildRuntimeRecord(record, nodeType)).toThrow(
      CanonicalBuildRuntimeError
    );
  });

  it('rejects activity flags that contradict the status', () => {
    const record = createRuntimeRecord({ status: 'completed', isActive: true });

    expect(() => assertCanonicalBuildRuntimeRecord(record, nodeType)).toThrow(
      CanonicalBuildRuntimeError
    );
  });
});
