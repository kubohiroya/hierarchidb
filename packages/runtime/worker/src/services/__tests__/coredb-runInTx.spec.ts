import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { CoreDB } from '../CoreDB.js';

describe('CoreDB runInTx coverage', () => {
  it('allows accessing trees table inside transactional runner', async () => {
    const db = await CoreDB.getSingleton('test');

    await expect(
      db.runInTx('rw', ['nodes', 'trees', 'rootStates', 'tags', 'tagAssociations'], async () => {
        const trees = await db.trees.toArray();
        expect(Array.isArray(trees)).toBe(true);
      }),
    ).resolves.toBeUndefined();
  });
});
