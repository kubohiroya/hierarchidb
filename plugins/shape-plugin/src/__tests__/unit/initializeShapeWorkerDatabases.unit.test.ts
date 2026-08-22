import { getDBName } from '@hierarchidb/util';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const databaseInitializers = vi.hoisted(() => ({
  ephemeral: vi.fn(),
  shape: vi.fn(),
  shapeChunks: vi.fn(),
}));

vi.mock('@hierarchidb/gis-sdk', () => ({
  initializeEphemeralDB: databaseInitializers.ephemeral,
}));

vi.mock('@hierarchidb/shape-store', () => ({
  initializeShapeDB: databaseInitializers.shape,
}));

vi.mock('../../services/utils/initializeShapeChunkStore.js', () => ({
  initializeShapeChunkStore: databaseInitializers.shapeChunks,
}));

import { initializeShapeWorkerDatabases } from '../../worker/initializeShapeWorkerDatabases.js';

describe('initializeShapeWorkerDatabases', () => {
  beforeEach(() => {
    databaseInitializers.ephemeral.mockReset();
    databaseInitializers.shape.mockReset();
    databaseInitializers.shapeChunks.mockReset();
  });

  it('initializes every shape worker database with its canonical name in dependency order', () => {
    const databasePrefix = 'shape-worker-test';

    initializeShapeWorkerDatabases(databasePrefix);

    expect(databaseInitializers.ephemeral).toHaveBeenCalledWith(
      getDBName(databasePrefix, 'ephemeral')
    );
    expect(databaseInitializers.shape).toHaveBeenCalledWith(getDBName(databasePrefix, 'shape'));
    expect(databaseInitializers.shapeChunks).toHaveBeenCalledWith(
      getDBName(databasePrefix, 'shape-chunks')
    );
    const ephemeralCallOrder = databaseInitializers.ephemeral.mock.invocationCallOrder[0];
    const shapeCallOrder = databaseInitializers.shape.mock.invocationCallOrder[0];
    const shapeChunksCallOrder = databaseInitializers.shapeChunks.mock.invocationCallOrder[0];
    if (
      ephemeralCallOrder === undefined ||
      shapeCallOrder === undefined ||
      shapeChunksCallOrder === undefined
    ) {
      throw new Error('shape worker database initializer call order is missing');
    }
    expect(ephemeralCallOrder).toBeLessThan(shapeCallOrder);
    expect(shapeCallOrder).toBeLessThan(shapeChunksCallOrder);
  });

  it('propagates initialization failure without attempting later databases', () => {
    databaseInitializers.ephemeral.mockImplementationOnce(() => {
      throw new Error('ephemeral-database-name-mismatch');
    });

    expect(() => initializeShapeWorkerDatabases('shape-worker-test')).toThrow(
      'ephemeral-database-name-mismatch'
    );
    expect(databaseInitializers.shape).not.toHaveBeenCalled();
    expect(databaseInitializers.shapeChunks).not.toHaveBeenCalled();
  });
});
