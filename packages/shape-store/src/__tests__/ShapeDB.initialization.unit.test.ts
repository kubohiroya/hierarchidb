import { describe, expect, it } from 'vitest';
import { getShapeDB, initializeShapeDB, shapeDB } from '../ShapeDB.js';

describe('ShapeDB explicit initialization', () => {
  it('fails closed before initialization and rejects another database name', () => {
    expect(() => getShapeDB()).toThrow('shape-database-not-initialized');
    expect(() => shapeDB.name).toThrow('shape-database-not-initialized');
    expect(() => initializeShapeDB('')).toThrow('shape-database-name-required');

    const database = initializeShapeDB('test-explicit-shape');

    expect(getShapeDB()).toBe(database);
    expect(shapeDB.name).toBe('test-explicit-shape');
    expect(() => initializeShapeDB('test-other-shape')).toThrow('shape-database-name-mismatch');
    database.close();
  });
});
