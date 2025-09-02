import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import { CoreDB } from '../services/CoreDB';
import { encodeTrashHolderName } from '../services/utils/holder-encoding';

export interface TrashMigrateOptions {
  dryRun?: boolean;
  limit?: number;
  verbose?: boolean;
  retries?: number;
}

export interface TrashMigrateReport {
  scanned: number;
  migrated: number;
  errors: number;
  details: Array<{ nodeId: NodeId; error?: string }>;
  durationMs?: number;
  errorsByReason?: Record<string, number>;
}

/**
 * Migrate legacy trash nodes (removedAt/original*) to holder-based structure under trashRoot.
 * - dryRun: when true, does not mutate; only reports planned actions.
 * - limit: optional cap on number of nodes migrated.
 */
export async function migrateTrashToHolder(coreDB: CoreDB, opts: TrashMigrateOptions = {}): Promise<TrashMigrateReport> {
  const started = Date.now();
  const dryRun = !!opts.dryRun;
  const verbose = !!opts.verbose;
  const limit = typeof opts.limit === 'number' ? opts.limit : Infinity;
  const retries = typeof opts.retries === 'number' ? opts.retries : 1;
  const report: TrashMigrateReport = { scanned: 0, migrated: 0, errors: 0, details: [] };

  // Build root->trashRoot map
  const trees = await coreDB.trees.toArray();
  const rootToTrash = new Map<NodeId, NodeId>(trees.map((t) => [t.rootId, t.trashRootId]));

  // Full scan; if dataset is large, add paging in future
  const all = await coreDB.nodes.toArray();
  for (const n of all) {
    report.scanned++;
    if (!n.removedAt || !n.originalParentId) continue; // legacy trash candidate only
    if (report.migrated >= limit) break;

    try {
      // Ascend to find rootId → trashRootId
      let cursor: NodeId | undefined = n.parentId;
      let trashRootId: NodeId | undefined = undefined;
      while (cursor) {
        if (rootToTrash.has(cursor)) {
          trashRootId = rootToTrash.get(cursor)!;
          break;
        }
        const parent = await coreDB.getNode(cursor);
        if (!parent || parent.parentId === cursor) break;
        cursor = parent.parentId;
      }
      if (!trashRootId) {
        report.details.push({ nodeId: n.id, error: 'trashRoot not found' });
        report.errors++;
        continue;
      }

      const holderId = (globalThis.crypto?.randomUUID?.() || `wc-${Date.now()}-${Math.random()}`) as NodeId;
      const holderName = encodeTrashHolderName(n.originalParentId as NodeId, n.id);
      if (!dryRun) {
        let attempt = 0;
        let lastErr: any;
        while (attempt <= retries) {
          try {
            await coreDB.createNode({
              id: holderId,
              parentId: trashRootId,
              nodeType: ('trash' as unknown) as any,
              name: holderName,
              depth: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              version: 1,
            } as unknown as TreeNode);
            await coreDB.updateNode({
              ...n,
              id: n.id,
              parentId: holderId,
              removedAt: undefined,
              originalParentId: undefined,
              originalName: undefined,
              updatedAt: Date.now(),
              version: (n.version || 1) + 1,
            });
            lastErr = undefined;
            break;
          } catch (e) {
            lastErr = e;
            if (verbose) console.warn(`migrate retry ${attempt + 1} for ${n.id}:`, e);
            if (attempt === retries) throw e;
            await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
          }
          attempt++;
        }
        if (lastErr) throw lastErr;
      }
      report.migrated++;
      report.details.push({ nodeId: n.id });
    } catch (e) {
      report.errors++;
      report.details.push({ nodeId: n.id, error: String(e) });
    }
  }

  report.durationMs = Date.now() - started;
  if (report.details.length) {
    const by: Record<string, number> = {};
    for (const d of report.details) {
      if (!d.error) continue;
      by[d.error] = (by[d.error] || 0) + 1;
    }
    if (Object.keys(by).length) report.errorsByReason = by;
  }
  return report;
}

/**
 * Roll back holder-based trash to legacy fields (removedAt/original*), deleting holders.
 * Intended for emergency revert.
 */
export async function rollbackHolderToLegacy(coreDB: CoreDB, opts: TrashMigrateOptions = {}): Promise<TrashMigrateReport> {
  const started = Date.now();
  const dryRun = !!opts.dryRun;
  const verbose = !!opts.verbose;
  const retries = typeof opts.retries === 'number' ? opts.retries : 1;
  const limit = typeof opts.limit === 'number' ? opts.limit : Infinity;
  const report: TrashMigrateReport = { scanned: 0, migrated: 0, errors: 0, details: [] };

  // Read trees to get trash roots
  const trees = await coreDB.trees.toArray();
  const trashRoots = new Set<NodeId>(trees.map((t) => t.trashRootId));

  // Find holders under any trash root
  const holders = await coreDB.nodes.toArray();
  for (const h of holders) {
    if (!trashRoots.has(h.parentId)) continue;
    report.scanned++;
    if (report.migrated >= limit) break;
    try {
      // Find child (trashed node) under holder
      const children = await coreDB.listChildren(h.id);
      const child = children[0];
      if (!child) continue;
      const parts = h.name.split('\t');
      if (parts.length !== 2) continue; // not a holder
      const originalParentId = parts[0] as NodeId;
      const originalName = child.name;
      if (!dryRun) {
        let attempt = 0;
        let lastErr: any;
        while (attempt <= retries) {
          try {
            await coreDB.updateNode({
              ...child,
              id: child.id,
              parentId: originalParentId,
              removedAt: Date.now(),
              originalParentId,
              originalName,
              updatedAt: Date.now(),
              version: (child.version || 1) + 1,
            } as any);
            await coreDB.deleteNode(h.id);
            lastErr = undefined;
            break;
          } catch (e) {
            lastErr = e;
            if (verbose) console.warn(`rollback retry ${attempt + 1} for ${child.id}:`, e);
            if (attempt === retries) throw e;
            await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
          }
          attempt++;
        }
        if (lastErr) throw lastErr;
      }
      report.migrated++;
      report.details.push({ nodeId: child.id });
    } catch (e) {
      report.errors++;
      report.details.push({ nodeId: h.id, error: String(e) });
    }
  }

  report.durationMs = Date.now() - started;
  if (report.details.length) {
    const by: Record<string, number> = {};
    for (const d of report.details) {
      if (!d.error) continue;
      by[d.error] = (by[d.error] || 0) + 1;
    }
    if (Object.keys(by).length) report.errorsByReason = by;
  }
  return report;
}

// Optional CLI entry (node -r esbuild-register)
if (require.main === module) {
  (async () => {
    const dryRun = process.argv.includes('--dry-run');
    const limitArg = process.argv.find((a) => a.startsWith('--limit='));
    const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;
    const rollback = process.argv.includes('--rollback');
    const verbose = process.argv.includes('--verbose');
    const retriesArg = process.argv.find((a) => a.startsWith('--retries='));
    const retries = retriesArg ? Number(retriesArg.split('=')[1]) : undefined;
    const core = await CoreDB.getSingleton(`migrate-${Date.now()}`);
    const rep = rollback
      ? await rollbackHolderToLegacy(core, { dryRun, limit, verbose, retries })
      : await migrateTrashToHolder(core, { dryRun, limit, verbose, retries });
    console.log(JSON.stringify(rep, null, 2));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
