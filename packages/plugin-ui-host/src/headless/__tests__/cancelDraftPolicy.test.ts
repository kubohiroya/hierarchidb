import type { TreeNodeUpdaterState } from '@hierarchidb/plugin-ui-sdk';
import { describe, expect, it } from 'vitest';
import { evaluateCancelPolicy } from '../cancelDraftPolicy.js';
import '@testing-library/jest-dom/vitest';
import type { NodeId } from '@hierarchidb/common-types';

const makeDraft = (overrides: Partial<TreeNodeUpdaterState> = {}): TreeNodeUpdaterState => ({
  treeNodeId: 'n1' as NodeId,
  draftMetadata: { name: 'Draft', description: '', tags: [] },
  draftData: {},
  ...overrides,
});

describe('evaluateCancelPolicy', () => {
  it('forces delete for create mode', () => {
    const decision = evaluateCancelPolicy('create', makeDraft());
    expect(decision).toBe('discard-force-delete');
  });

  it('keeps draft for edit mode with only draft atoms (template/imported)', () => {
    const decision = evaluateCancelPolicy('edit', makeDraft({ data: null, version: 1 }));
    expect(decision).toBe('keep-draft');
  });

  it('discards draft only when committed data exists', () => {
    const decision = evaluateCancelPolicy(
      'edit',
      makeDraft({ data: { committed: true }, version: 2 })
    );
    expect(decision).toBe('discard-draft-only');
  });

  it('discards draft only when committed version exists even without data', () => {
    const decision = evaluateCancelPolicy('edit', makeDraft({ data: null, version: 3 }));
    expect(decision).toBe('discard-draft-only');
  });
});
