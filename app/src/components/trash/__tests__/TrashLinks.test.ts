import { describe, it, expect } from 'vitest';
import type { NodeId } from '@hierarchidb/common-types';
import { buildTreeConsoleLinkHref } from '@hierarchidb/ui-treeconsole-breadcrumb';

describe('TrashDialog link wiring', () => {
  const treeId = 'r';
  const pageNodeId = 'r:root' as NodeId;
  const placeholderId = 'holder-1' as NodeId;
  const grandchildId = 'grandchild-1' as NodeId;

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
