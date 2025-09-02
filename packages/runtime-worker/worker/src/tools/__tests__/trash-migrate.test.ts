import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';
import { CoreDB } from '../../services/CoreDB';
import { migrateTrashToHolder, rollbackHolderToLegacy } from '../trash-migrate';

describe('trash-migrate tools (headless)', () => {
  async function newCore(name: string): Promise<CoreDB> {
    return await CoreDB.getSingleton(`migrate-${name}-${Date.now()}-${Math.random()}`);
  }

  it('migrate legacy -> holder and rollback holder -> legacy (dry-run and commit)', async () => {
    const core = await newCore('roundtrip');
    // Prepare a legacy trashed node under r:root
    const n: TreeNode = {
      id: ('n-' + Date.now()) as NodeId,
      parentId: 'r:root' as NodeId,
      nodeType: 'folder' as NodeType,
      name: 'LegacyTrash',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      removedAt: Date.now(),
      originalParentId: 'r:root' as NodeId,
      originalName: 'LegacyTrash',
    } as any;
    await core.createNode(n);

    // dry-run: report only
    const dry = await migrateTrashToHolder(core, { dryRun: true });
    expect(dry.scanned).toBeGreaterThan(0);

    // commit: holder path
    const rep = await migrateTrashToHolder(core, { dryRun: false });
    expect(rep.migrated).toBeGreaterThan(0);

    // rollback: back to legacy fields
    const back = await rollbackHolderToLegacy(core, { dryRun: false, limit: 10 });
    expect(back.scanned).toBeGreaterThan(0);
  });
});

