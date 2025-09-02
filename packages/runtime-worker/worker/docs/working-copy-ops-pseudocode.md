vk:doc kind=spec audience=dev scope=worker

# WorkingCopy 主要オペレーション擬似コード

この文書は実装を変えずに、Tx境界と典型エラー処理、戻りスキーマを共有する目的の草案です。

## Tx一貫性（原則）
- holder/child/関連エンティティの作成・反映・削除は同一DBトランザクションで原子的に行う。
- 途中失敗時は全体ロールバック（別スレッド通知やUI更新はTx外で非同期に行う）。

## createWorkingCopy（get-or-create）

```ts
type CreateWcResult = {
  wcHolderId: string;
  wcNodeId: string; // child id
  returnedExisting: boolean;
};

async function createWorkingCopy(treeId: string, targetParentId: string, targetNodeId: string | null): Promise<CreateWcResult> {
  const workingCopyRootId = getWorkingCopyRootId(treeId);
  const name = encodeHolderName(targetParentId, targetNodeId ?? preallocateNodeId());

  return db.transaction('rw', db.nodes, async () => {
    // 1) Try find existing holder
    const holder = await db.nodes.where('[parentId+name]').equals([workingCopyRootId, name]).first();
    if (holder) {
      const child = await getSingleChild(holder.id);
      return { wcHolderId: holder.id, wcNodeId: child.id, returnedExisting: true };
    }

    // 2) Create holder + child atomically
    const wcHolderId = allocNodeId();
    await db.nodes.put({ id: wcHolderId, parentId: workingCopyRootId, name, type: 'workingCopyHolder' });
    const wcNodeId = allocNodeIdOrGiven(targetNodeId); // given for draft, else new for edit copy
    await db.nodes.put({ id: wcNodeId, parentId: wcHolderId, name: 'wc', type: 'workingCopy' /* payload... */ });

    return { wcHolderId, wcNodeId, returnedExisting: false };
  }).catch(async (err) => {
    if (isConstraintError(err)) {
      // Another tab created it concurrently. Re-read existing.
      const holder = await db.nodes.where('[parentId+name]').equals([workingCopyRootId, name]).first();
      if (!holder) throw err; // unexpected
      const child = await getSingleChild(holder.id);
      return { wcHolderId: holder.id, wcNodeId: child.id, returnedExisting: true };
    }
    throw err;
  });
}
```

## commitWorkingCopy（編集/ドラフト統合）

```ts
type CommitOk = { status: 'ok'; autoRenameTo?: string };
type CommitConflict = { status: 'COMMIT_CONFLICT'; originalVersion: number; wcVersion: number };
type NameConflict = { status: 'NAME_CONFLICT'; suggestedName: string };
type CommitResult = CommitOk | CommitConflict | NameConflict;

async function commitWorkingCopy(treeId: string, wcHolderId: string): Promise<CommitResult> {
  const holder = await db.nodes.get(wcHolderId);
  if (!holder) throw new Error('WC holder not found');
  const { targetParentNodeId, targetNodeId } = decodeHolderName(holder.name);
  const wcNode = await getSingleChild(holder.id);

  return db.transaction('rw', db.nodes, /* entity tables... */, async () => {
    const original = await db.nodes.get(targetNodeId);
    const isDraft = !original; // draft if original does not exist yet

    if (!isDraft) {
      // optimistic lock
      if (original.version > wcNode.version) {
        return { status: 'COMMIT_CONFLICT', originalVersion: original.version, wcVersion: wcNode.version } as CommitConflict;
      }
      // apply fields to original (merge policy per node-type)
      await applyNodeMerge(original, wcNode);
    } else {
      // create new under targetParent with name policy
      const nameOk = await ensureUniqueName(targetParentNodeId, wcNode.name);
      if (!nameOk.ok) {
        // auto-rename policy
        const autoName = nameOk.suggested;
        await createNodeUnder(targetParentNodeId, targetNodeId, { ...wcNode, name: autoName });
        // report the rename for UI
        await deleteNode(wcNode.id);
        await deleteNode(holder.id);
        return { status: 'ok', autoRenameTo: autoName } as CommitOk;
      }
      await createNodeUnder(targetParentNodeId, targetNodeId, wcNode);
    }

    // Entities: write-back from WC rows (same tx), then delete WC rows
    await writeBackEntitiesFromWc(wcNode.id);

    // cleanup WC (holder + child)
    await deleteNode(wcNode.id);
    await deleteNode(holder.id);
    return { status: 'ok' } as CommitOk;
  });
}
```

## 移動/削除のブロック判定（ポリシーC）

```ts
async function hasWcInSubtree(rootId: string, targetId: string): Promise<boolean> {
  const subtreeIds = await collectSubtreeIds(targetId); // BFS via parentId index
  const workingCopyRootId = getWorkingCopyRootId(rootId);
  const holders = await db.nodes.where('parentId').equals(workingCopyRootId).toArray();
  for (const h of holders) {
    const { targetParentNodeId, targetNodeId } = decodeHolderName(h.name);
    if (subtreeIds.has(targetNodeId) || subtreeIds.has(targetParentNodeId)) return true;
  }
  return false;
}
```

## 注意
- 擬似コードは Tx 境界と戻り値の形を共有するための雛形。実装詳細（型/フィールド名/マージロジック）は各 node-type の仕様に従う。
