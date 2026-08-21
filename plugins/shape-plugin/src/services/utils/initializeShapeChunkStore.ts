let shapeChunkStoreDatabaseName: string | null = null;

export const initializeShapeChunkStore = (databaseName: string): void => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(databaseName)) {
    throw new Error('shape-chunk-store-database-name-invalid');
  }
  if (shapeChunkStoreDatabaseName !== null && shapeChunkStoreDatabaseName !== databaseName) {
    throw new Error('shape-chunk-store-database-name-mismatch');
  }
  shapeChunkStoreDatabaseName = databaseName;
};

export const getShapeChunkStoreDatabaseName = (): string => {
  if (shapeChunkStoreDatabaseName === null) {
    throw new Error('shape-chunk-store-database-not-initialized');
  }
  return shapeChunkStoreDatabaseName;
};
