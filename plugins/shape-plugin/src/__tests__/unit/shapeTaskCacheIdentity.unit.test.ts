import { describe, expect, it } from 'vitest';
import type { TaskQueueRecord } from '@hierarchidb/build-api';
import {
  buildSourceTaskCacheIdentity,
  buildGeometryTaskCacheIdentity,
  buildTileEmitTaskCacheIdentity,
  resolveTaskCacheIdentity,
} from '../../services/vt/shapeTaskCacheIdentity';
import type { NodeId } from "@hierarchidb/core-types";

describe('shapeTaskCacheIdentity', () => {
  it('uses namespace policy to switch source key space', () => {
    const nodeScoped = buildSourceTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      configSignature: 'sig-1',
      namespacePolicy: { source: 'node' },
    });
    const globalScoped = buildSourceTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      configSignature: 'sig-1',
      namespacePolicy: { source: 'global' },
    });
    expect(nodeScoped.cacheKey).toContain('node:node-1:shape:source');
    expect(globalScoped.cacheKey).toContain('global:shape:source');
  });

  it('keeps source inputHash stable when cache-key-only fields change', () => {
    const first = buildSourceTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      configSignature: 'sig-1',
    });
    const second = buildSourceTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      dataSource: 'gadm',
      sourceKey: 'JP:1',
      url: 'https://example.com/b?token=123',
      configSignature: 'sig-1',
    });
    expect(first.cacheKey).not.toEqual(second.cacheKey);
    expect(first.inputHash).toEqual(second.inputHash);
  });

  it('changes geometry inputHash when output-affecting payload changes', () => {
    const first = buildGeometryTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      sourceKey: 'JP:0',
      bandIndex: 2,
      sourceArtifactHash: 'artifact:a',
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    const second = buildGeometryTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      sourceKey: 'JP:0',
      bandIndex: 2,
      sourceArtifactHash: 'artifact:b',
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    expect(first.cacheKey).toEqual(second.cacheKey);
    expect(first.inputHash).not.toEqual(second.inputHash);
  });

  it('changes geometry inputHash when sourceBaseTolerance changes', () => {
    const first = buildGeometryTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      sourceKey: 'JP:0',
      bandIndex: 2,
      sourceArtifactHash: 'artifact:a',
      sourceBaseTolerance: 0.125,
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    const second = buildGeometryTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      sourceKey: 'JP:0',
      bandIndex: 2,
      sourceArtifactHash: 'artifact:a',
      sourceBaseTolerance: 0.25,
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    expect(first.cacheKey).toEqual(second.cacheKey);
    expect(first.inputHash).not.toEqual(second.inputHash);
  });

  it('changes source inputHash when upstreamRevision changes', () => {
    const first = buildSourceTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      upstreamRevision: 'etag:v1',
      configSignature: 'sig-1',
    });
    const second = buildSourceTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      upstreamRevision: 'etag:v2',
      configSignature: 'sig-1',
    });
    expect(first.cacheKey).toEqual(second.cacheKey);
    expect(first.inputHash).not.toEqual(second.inputHash);
  });

  it('normalizes tileEmit buffer set for stable inputHash', () => {
    const first = buildTileEmitTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      bandIndex: 3,
      zBase: 6,
      tileId: 123,
      bufferIds: ['b', 'a', 'a'],
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    const second = buildTileEmitTaskCacheIdentity({
      nodeId: 'node-1' as NodeId,
      bandIndex: 3,
      zBase: 6,
      tileId: 123,
      bufferIds: ['a', 'b'],
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    expect(first.inputHash).toEqual(second.inputHash);
  });

  it('prefers persisted cacheKey/inputHash on task inputData', () => {
    const task: TaskQueueRecord = {
      taskId: 'task-1',
      nodeId: 'node-1' as NodeId,
      stage: 'source',
      status: 'queued',
      index: 0,
      progress: 0,
      inputData: {
        sourceKey: 'JP:0',
        configSignature: 'sig-1',
        cacheKey: 'persisted-key',
        inputHash: 'persisted-hash',
      },
    };
    const identity = resolveTaskCacheIdentity(task);
    expect(identity).toEqual({
      cacheKey: 'persisted-key',
      inputHash: 'persisted-hash',
    });
  });
});
