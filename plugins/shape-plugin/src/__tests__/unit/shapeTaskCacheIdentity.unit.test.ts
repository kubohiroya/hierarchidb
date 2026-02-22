import { describe, expect, it } from 'vitest';
import type { TaskQueueRecord } from 'packages/build-api';
import {
  buildFetchTaskCacheIdentity,
  buildTransformTaskCacheIdentity,
  buildVtTaskCacheIdentity,
  resolveTaskCacheIdentity,
} from '../../services/vt/shapeTaskCacheIdentity';

describe('shapeTaskCacheIdentity', () => {
  it('uses namespace policy to switch fetch key space', () => {
    const nodeScoped = buildFetchTaskCacheIdentity({
      nodeId: 'node-1',
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      configSignature: 'sig-1',
      namespacePolicy: { fetch: 'node' },
    });
    const globalScoped = buildFetchTaskCacheIdentity({
      nodeId: 'node-1',
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      configSignature: 'sig-1',
      namespacePolicy: { fetch: 'global' },
    });
    expect(nodeScoped.cacheKey).toContain('node:node-1:shape:fetch');
    expect(globalScoped.cacheKey).toContain('global:shape:fetch');
  });

  it('keeps fetch inputHash stable when cache-key-only fields change', () => {
    const first = buildFetchTaskCacheIdentity({
      nodeId: 'node-1',
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      configSignature: 'sig-1',
    });
    const second = buildFetchTaskCacheIdentity({
      nodeId: 'node-1',
      dataSource: 'gadm',
      sourceKey: 'JP:1',
      url: 'https://example.com/b?token=123',
      configSignature: 'sig-1',
    });
    expect(first.cacheKey).not.toEqual(second.cacheKey);
    expect(first.inputHash).toEqual(second.inputHash);
  });

  it('changes transform inputHash when output-affecting payload changes', () => {
    const first = buildTransformTaskCacheIdentity({
      nodeId: 'node-1',
      sourceKey: 'JP:0',
      bandIndex: 2,
      fetchArtifactHash: 'artifact:a',
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    const second = buildTransformTaskCacheIdentity({
      nodeId: 'node-1',
      sourceKey: 'JP:0',
      bandIndex: 2,
      fetchArtifactHash: 'artifact:b',
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    expect(first.cacheKey).toEqual(second.cacheKey);
    expect(first.inputHash).not.toEqual(second.inputHash);
  });

  it('changes fetch inputHash when upstreamRevision changes', () => {
    const first = buildFetchTaskCacheIdentity({
      nodeId: 'node-1',
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      upstreamRevision: 'etag:v1',
      configSignature: 'sig-1',
    });
    const second = buildFetchTaskCacheIdentity({
      nodeId: 'node-1',
      dataSource: 'gadm',
      sourceKey: 'JP:0',
      url: 'https://example.com/a',
      upstreamRevision: 'etag:v2',
      configSignature: 'sig-1',
    });
    expect(first.cacheKey).toEqual(second.cacheKey);
    expect(first.inputHash).not.toEqual(second.inputHash);
  });

  it('normalizes vt buffer set for stable inputHash', () => {
    const first = buildVtTaskCacheIdentity({
      nodeId: 'node-1',
      bandIndex: 3,
      zBase: 6,
      tileId: 123,
      bufferIds: ['b', 'a', 'a'],
      bandMinZoom: 6,
      bandMaxZoom: 8,
      configSignature: 'sig-1',
    });
    const second = buildVtTaskCacheIdentity({
      nodeId: 'node-1',
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
      nodeId: 'node-1',
      stage: 'fetch',
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
