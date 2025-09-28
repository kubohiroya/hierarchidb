import { describe, expect, it } from 'vitest';
import {
  decodeTrashHolderName,
  decodeWorkingCopyHolderName,
  encodeTrashHolderName,
  encodeWorkingCopyHolderName,
  HOLDER_NAME_TAB,
  isValidTrashHolderName,
  isValidWorkingCopyHolderName,
} from './holder-encoding.js';
import type { NodeId } from '@hierarchidb/common-type';

describe('holder-encoding v1 (TAB separator)', () => {
  it('encodes and decodes WorkingCopy holder name roundtrip', () => {
    const parentId = 'r:workingCopy' as NodeId;
    const targetNodeId = 'node-abc-123' as NodeId;
    const name = encodeWorkingCopyHolderName(parentId, targetNodeId);
    const decoded = decodeWorkingCopyHolderName(name);
    expect(decoded).toEqual({ targetParentNodeId: parentId, targetNodeId });
    expect(isValidWorkingCopyHolderName(name)).toBe(true);
  });

  it('encodes and decodes Trash holder name roundtrip', () => {
    const originalParentId = 'r:trash' as NodeId;
    const trashedNodeId = 'node-dead-beef' as NodeId;
    const name = encodeTrashHolderName(originalParentId, trashedNodeId);
    const decoded = decodeTrashHolderName(name);
    expect(decoded).toEqual({ originalParentNodeId: originalParentId, trashedNodeId });
    expect(isValidTrashHolderName(name)).toBe(true);
  });

  it('rejects TAB in IDs for WorkingCopy encoding', () => {
    expect(() => encodeWorkingCopyHolderName('bad\tid' as NodeId, 'ok' as NodeId)).toThrow();
    expect(() => encodeWorkingCopyHolderName('ok' as NodeId, 'bad\tid' as NodeId)).toThrow();
  });

  it('rejects TAB in IDs for Trash encoding', () => {
    expect(() => encodeTrashHolderName('bad\tid' as NodeId, 'ok' as NodeId)).toThrow();
    expect(() => encodeTrashHolderName('ok' as NodeId, 'bad\tid' as NodeId)).toThrow();
  });

  it('throws on invalid holder name format (WorkingCopy)', () => {
    expect(() => decodeWorkingCopyHolderName('no-sep')).toThrow();
    expect(() => decodeWorkingCopyHolderName(`${HOLDER_NAME_TAB}leading`)).toThrow();
    expect(() => decodeWorkingCopyHolderName(`trailing${HOLDER_NAME_TAB}`)).toThrow();
  });

  it('throws on invalid holder name format (Trash)', () => {
    expect(() => decodeTrashHolderName('no-sep')).toThrow();
    expect(() => decodeTrashHolderName(`${HOLDER_NAME_TAB}leading`)).toThrow();
    expect(() => decodeTrashHolderName(`trailing${HOLDER_NAME_TAB}`)).toThrow();
  });

  it('exposes TAB separator constant', () => {
    expect(HOLDER_NAME_TAB).toBe('\t');
  });

  it('rejects empty or extreme length in decode (WorkingCopy)', () => {
    expect(() => decodeWorkingCopyHolderName('')).toThrow();
    const veryLong = 'x'.repeat(10_000) + HOLDER_NAME_TAB + 'y';
    // decode itself allows long strings but should not throw on valid format
    expect(() => decodeWorkingCopyHolderName(veryLong)).not.toThrow();
  });

  it('micro-bench: encode/decode 1000 times stays under 50ms', () => {
    const parentId = 'r:workingCopy' as NodeId;
    const targetNodeId = 'node-abc-123' as NodeId;
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const n = encodeWorkingCopyHolderName(parentId, targetNodeId);
      const d = decodeWorkingCopyHolderName(n);
      expect(d.targetParentNodeId).toBe(parentId);
      expect(d.targetNodeId).toBe(targetNodeId);
    }
    const dur = performance.now() - start;
    expect(dur).toBeLessThan(50);
  });
});
