import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expectTypeOf, it } from 'vitest';
import { createEnvelope } from '../../envelope.util.js';
import type { PayloadOf, ResultOf } from '../../registry.types.js';

describe('CommandRegistry types: envelope inference', () => {
  it('infers payload type from kind (moveNodes)', () => {
    const payload: PayloadOf<'moveNodes'> = {
      nodeIds: [] as NodeId[],
      toParentId: 'parent' as NodeId,
    };
    const env = createEnvelope('moveNodes', payload);

    expectTypeOf(env.kind).toEqualTypeOf<'moveNodes'>();
    expectTypeOf(env.payload).toEqualTypeOf<PayloadOf<'moveNodes'>>();
  });

  it('infers payload type from kind (undo/redo)', () => {
    const undoEnv = createEnvelope('undo', { groupId: 'g1' } satisfies PayloadOf<'undo'>);
    const redoEnv = createEnvelope('redo', { groupId: 'g2' } satisfies PayloadOf<'redo'>);
    expectTypeOf(undoEnv.payload).toEqualTypeOf<PayloadOf<'undo'>>();
    expectTypeOf(redoEnv.payload).toEqualTypeOf<PayloadOf<'redo'>>();
  });

  it('ResultOf<K> remains tied to K', () => {
    type MoveResult = ResultOf<'moveNodes'>;
    // Success path must include seq; optional fields allowed
    expectTypeOf<MoveResult>().toMatchTypeOf<{ success: boolean }>();
  });

  it('createEnvelope accepts optional init and preserves typing', () => {
    const env = createEnvelope(
      'pasteNodes',
      {
        nodes: {} as Record<NodeId, TreeNode>,
        nodeIds: [] as NodeId[],
        toParentId: 'p' as NodeId,
      },
      { commandId: 'c1', groupId: 'g1', sourceViewId: 'view-1' }
    );
    expectTypeOf(env.payload).toEqualTypeOf<PayloadOf<'pasteNodes'>>();
  });

  it('includes draft lifecycle and trash ops in CommandMap', () => {
    // Draft lifecycle
    const c1 = createEnvelope('createDraftForCreate', {
      draftOf: 'n1' as NodeId,
      parentId: 'p1' as NodeId,
      name: 'x',
      description: 'd',
      nodeType: 'folder' as NodeType,
    } satisfies PayloadOf<'createDraftForCreate'>);
    expectTypeOf(c1.payload).toEqualTypeOf<PayloadOf<'createDraftForCreate'>>();

    // Trash related
    const mt = createEnvelope('moveToTrash', {
      nodeIds: [] as NodeId[],
    } satisfies PayloadOf<'moveToTrash'>);
    expectTypeOf(mt.payload).toEqualTypeOf<PayloadOf<'moveToTrash'>>();

    const rt = createEnvelope('restoreFromTrash', {
      nodeIds: [] as NodeId[],
    } satisfies PayloadOf<'restoreFromTrash'>);
    expectTypeOf(rt.payload).toEqualTypeOf<PayloadOf<'restoreFromTrash'>>();
  });
});
