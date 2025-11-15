import type { NodeId } from '@hierarchidb/common-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BaseMapEntityHandler } from '../../hooks/BaseMapEntityHandler.js';

describe('BaseMapEntityHandler', () => {
  let handler: BaseMapEntityHandler;
  let nodeId: NodeId;

  beforeEach(() => {
    handler = new BaseMapEntityHandler();
    nodeId = `basemap-${crypto.randomUUID()}` as NodeId;
  });

  afterEach(async () => {
    const entity = await handler.getEntityByNodeId(nodeId);
    if (entity) {
      await handler.deleteEntity(entity.id).catch(() => {});
    }
  });

  it('creates an entity with default configuration', async () => {
    const entity = await handler.createEntity(nodeId);
    expect(entity.id).toBe(nodeId);
    expect(entity.mapStyle.style).toBe('streets');
    expect(entity.viewport.center).toEqual([0, 0]);
    expect(entity.viewport.zoom).toBe(2);
  });

  it('creates an entity with custom configuration', async () => {
    const entity = await handler.createEntity(nodeId, {
      mapStyle: { style: 'terrain' },
      viewport: { center: [139.6917, 35.6895], zoom: 12, bearing: 30, pitch: 10 },
    });
    expect(entity.mapStyle.style).toBe('terrain');
    expect(entity.viewport.center).toEqual([139.6917, 35.6895]);
    expect(entity.viewport.zoom).toBe(12);
  });

  it('updates map style and viewport independently', async () => {
    await handler.createEntity(nodeId);
    const updatedStyle = await handler.updateMapStyle(nodeId, {
      style: 'custom',
      customStyleUrl: 'https://example.com/style.json',
    });
    expect(updatedStyle.mapStyle.style).toBe('custom');
    expect(updatedStyle.mapStyle.customStyleUrl).toBe('https://example.com/style.json');

    const updatedViewport = await handler.updateViewport(nodeId, {
      center: [10, 20],
      zoom: 8,
      bearing: 90,
      pitch: 15,
    });
    expect(updatedViewport.viewport.center).toEqual([10, 20]);
    expect(updatedViewport.viewport.zoom).toBe(8);
  });

  it('creates and commits a working copy', async () => {
    await handler.createEntity(nodeId, {
      mapStyle: { style: 'dark' },
      viewport: { center: [1, 2], zoom: 4, bearing: 0, pitch: 0 },
    });
    const workingCopy = await handler.createWorkingCopy(nodeId);
    expect(workingCopy.mapStyle.style).toBe('dark');

    workingCopy.mapStyle.style = 'light';
    workingCopy.viewport.zoom = 6;
    const entity = await handler.commitWorkingCopy(nodeId, workingCopy);
    expect(entity.mapStyle.style).toBe('light');
    expect(entity.viewport.zoom).toBe(6);
  });

  it('returns configuration snapshot for consumers', async () => {
    await handler.createEntity(nodeId, {
      mapStyle: { style: 'satellite' },
      viewport: { center: [35.0, 45.0], zoom: 7, bearing: 0, pitch: 0 },
    });
    const config = await handler.getConfiguration(nodeId);
    expect(config).not.toBeNull();
    expect(config?.mapStyle.style).toBe('satellite');
    expect(config?.viewport.zoom).toBe(7);
  });
});
