vk:doc kind=spec audience=dev scope=worker,tree

# WorkingCopy Holder 名称エンコード仕様（v1）

## 目的
- `workingCopyRoot` 直下に作成する holder ノードの `name` で、対象親・対象ノード（または新規の予定ノード）を一意に表現する規約を定義する。

## 不変条件
- 形式（v1）: `${targetParentNodeId}\t${targetNodeId}`（区切りはタブ文字 U+0009）。
- `targetParentNodeId` / `targetNodeId` はともに非空文字列。
- child（実体の WC ノード）は holder の直下に1つのみ。

## 用語
- 編集WC: `targetNodeId = originalNodeId`（既存ノードの編集）。
- ドラフトWC: `targetNodeId = commit時に採用予定の新規 nodeId`（ドラフト作成時に採番）。

## API（ユーティリティ規約・擬似コード）

```ts
// NOTE: Use these helpers everywhere to avoid format drift.
export function encodeHolderName(targetParentNodeId: string, targetNodeId: string): string {
  // In v1, NodeId must not include a tab character. Assert defensively.
  if (!targetParentNodeId || !targetNodeId) throw new Error('invalid ids');
  if (targetParentNodeId.includes('\t') || targetNodeId.includes('\t')) {
    throw new Error('nodeId must not include TAB in v1');
  }
  return `${targetParentNodeId}\t${targetNodeId}`;
}

export function decodeHolderName(name: string): { targetParentNodeId: string; targetNodeId: string } {
  const i = name.indexOf('\t');
  if (i <= 0 || i >= name.length - 1) throw new Error('invalid holder name');
  return { targetParentNodeId: name.slice(0, i), targetNodeId: name.slice(i + 1) };
}
```

## バリデーション
- `name` に `\t` が1つだけ含まれること。
- 分割後の2要素は非空であること。

## 将来拡張の余地
- v2 以降でバージョン識別子や Base64URL エンコードへの切替を検討（`v2:<b64(parent)>:<b64(target)>` など）。
- 現行実装は v1 固定（`\t` 区切り、ID自体に `\t` を含めない）。

## 参照
- `docs/working-copy-alignment-status.md`（単一WC共有、移動/削除ブロック方針）
- `docs/adr/adr-single-working-copy-per-target.md`
- `docs/adr/adr-block-move-delete-when-wc-in-subtree.md`

