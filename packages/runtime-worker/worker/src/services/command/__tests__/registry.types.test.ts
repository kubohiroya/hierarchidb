import { describe, expectTypeOf, it } from 'vitest';
import { createEnvelope } from '../envelope.util.js';
import type { PayloadOf, ResultOf } from '../registry.types.js';
import type { NodeId, NodeType } from '@hierarchidb/common-type';

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
        nodes: {} as Record<NodeId, unknown>,
        nodeIds: [] as NodeId[],
        toParentId: 'p' as NodeId,
      },
      { commandId: 'c1', groupId: 'g1', sourceViewId: 'view-1' },
    );
    expectTypeOf(env.payload).toEqualTypeOf<PayloadOf<'pasteNodes'>>();
  });

  it('includes working copy lifecycle and trash ops in CommandMap', () => {
    // Working copy lifecycle
    const c1 = createEnvelope(
      'createWorkingCopyForCreate',
      {
        workingCopyOf: 'n1' as NodeId,
        parentId: 'p1' as NodeId,
        name: 'x',
        description: 'd',
        nodeType: 'folder' as NodeType,
      } satisfies PayloadOf<'createWorkingCopyForCreate'>,
    );
    expectTypeOf(c1.payload).toEqualTypeOf<PayloadOf<'createWorkingCopyForCreate'>>();

    // Trash related
    const mt = createEnvelope('moveToTrash', { nodeIds: [] as NodeId[] } satisfies PayloadOf<'moveToTrash'>);
    expectTypeOf(mt.payload).toEqualTypeOf<PayloadOf<'moveToTrash'>>();

    const rt = createEnvelope(
      'recoverFromTrash',
      {
        nodeIds: [] as NodeId[],
      } satisfies PayloadOf<'recoverFromTrash'>,
    );
    expectTypeOf(rt.payload).toEqualTypeOf<PayloadOf<'recoverFromTrash'>>();
  });
});
