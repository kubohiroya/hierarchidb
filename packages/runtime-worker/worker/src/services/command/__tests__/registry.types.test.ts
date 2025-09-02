import { describe, it, expectTypeOf } from 'vitest';
import { createEnvelope } from '../envelope.util';
import type { PayloadOf, ResultOf } from '../registry.types';
import type { NodeId } from '@hierarchidb/common-type';

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
    const undoEnv = createEnvelope('undo', { groupId: 'g1' as unknown as string } as PayloadOf<'undo'>);
    const redoEnv = createEnvelope('redo', { groupId: 'g2' as unknown as string } as PayloadOf<'redo'>);
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
      } as PayloadOf<'pasteNodes'>,
      { commandId: 'c1', groupId: 'g1', sourceViewId: 'view-1' }
    );
    expectTypeOf(env.payload).toEqualTypeOf<PayloadOf<'pasteNodes'>>();
  });

  it('includes working copy lifecycle and trash ops in CommandMap', () => {
    // Working copy lifecycle
    const c1 = createEnvelope('createWorkingCopyForCreate', {
      workingCopyOf: 'n1' as any,
      parentId: 'p1' as any,
      name: 'x',
      description: 'd',
      nodeType: 'folder' as any,
    } as PayloadOf<'createWorkingCopyForCreate'>);
    expectTypeOf(c1.payload).toEqualTypeOf<PayloadOf<'createWorkingCopyForCreate'>>();

    // Trash related
    const mt = createEnvelope('moveToTrash', { nodeIds: [] as any } as PayloadOf<'moveToTrash'>);
    expectTypeOf(mt.payload).toEqualTypeOf<PayloadOf<'moveToTrash'>>();

    const rt = createEnvelope('recoverFromTrash', {
      nodeIds: [] as any,
    } as PayloadOf<'recoverFromTrash'>);
    expectTypeOf(rt.payload).toEqualTypeOf<PayloadOf<'recoverFromTrash'>>();
  });
});
