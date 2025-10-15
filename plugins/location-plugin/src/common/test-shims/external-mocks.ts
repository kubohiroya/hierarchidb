export class BatchService {
  async mapChunks<T, R>(items: T[], mapper: (item: T) => Promise<R>, _options?: { concurrency?: number }): Promise<R[]> {
    const results: R[] = [];
    for (const item of items) {
      results.push(await mapper(item));
    }
    return results;
  }
}

export class TabularWriter {
  constructor(_namespace: string) {}

  async begin(_config: { filename: string; columns: string[] }) {
    // no-op for tests
  }

  async writeRows<T>(_rows: T[]): Promise<void> {
    // no-op
  }

  async commit(): Promise<{ tableId: string }> {
    return { tableId: 'test-table-id' };
  }
}

// default exports expected by SessionController
export const vtpbf = {
  fromGeojson: () => new Uint8Array(),
};
export const geojsonvt = (..._args: unknown[]) => ({
  getTile: () => ({ features: [] as unknown[] }),
});
// Support both default and named import styles
module.exports = Object.assign(module.exports || {}, { default: vtpbf, geojsonvt });
