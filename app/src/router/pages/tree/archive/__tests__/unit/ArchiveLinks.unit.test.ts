import type { NodeId } from '@hierarchidb/core-types';
import { buildTreeConsoleLinkHref } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { describe, expect, it } from 'vitest';

const treeId = 'r';
const pageNodeId = 'r:root' as NodeId;
const grandchildId = 'grandchild-1' as NodeId;

describe('ArchiveDialog link wiring', () => {
  it('generates archive-specific URLs with page node id segment', () => {
    const href = buildTreeConsoleLinkHref({
      treeId,
      nodeId: grandchildId,
      pageNodeId,
      holderType: 'archive',
      holderTargetId: grandchildId,
      holderMetaParentId: pageNodeId,
      useArchiveColumns: true,
      archiveAction: 'restore',
    });

    expect(href).toBe(`/t/${treeId}/${pageNodeId}/${grandchildId}/archive/restore`);
  });
});
