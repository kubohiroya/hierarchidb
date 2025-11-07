import type { NodeId } from '@hierarchidb/common-types';
import { buildTreeConsoleLinkHref } from '@hierarchidb/ui-shell/ui-treeconsole-breadcrumb';
import { describe, expect, it } from 'vitest';

const treeId = 'r';
const pageNodeId = 'r:root' as NodeId;
const grandchildId = 'grandchild-1' as NodeId;

describe('TrashDialog link wiring', () => {
  it('generates trash-specific URLs with page node id segment', () => {
    const href = buildTreeConsoleLinkHref({
      treeId,
      nodeId: grandchildId,
      pageNodeId,
      holderType: 'trash',
      holderTargetId: grandchildId,
      holderMetaParentId: pageNodeId,
      useTrashColumns: true,
      trashAction: 'restore',
    });

    expect(href).toBe(`/t/${treeId}/${pageNodeId}/${grandchildId}/trash/restore`);
  });
});
