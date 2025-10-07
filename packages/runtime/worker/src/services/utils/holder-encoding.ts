// Holder name encoding utilities
// NOTE: Shared utilities for WorkingCopy and Trash holder pair patterns.
// Keep comments in English for codebase consistency.
import type { NodeId } from '@hierarchidb/common-types';

// Public constant for holder name separator (v1)
export const HOLDER_NAME_TAB = '\t'; // U+0009 (TAB)
const SEP = HOLDER_NAME_TAB;

function assertNoTab(value: string, label: string) {
  if (!value) throw new Error(`${label} must be non-empty`);
  if (value.includes(SEP)) throw new Error(`${label} must not include TAB (v1 constraint)`);
}

// WorkingCopy holder encoding: `${targetParentNodeId}\t${targetNodeId}`
export function encodeWorkingCopyHolderName(targetParentNodeId: NodeId, targetNodeId: NodeId): string {
  assertNoTab(targetParentNodeId, 'targetParentNodeId');
  assertNoTab(targetNodeId, 'targetNodeId');
  return `${targetParentNodeId}${SEP}${targetNodeId}`;
}

export function decodeWorkingCopyHolderName(name: string): { targetParentNodeId: NodeId; targetNodeId: NodeId } {
  const i = name.indexOf(SEP);
  if (i <= 0 || i >= name.length - 1) throw new Error('Invalid workingCopy holder name');
  return { targetParentNodeId: name.slice(0, i) as NodeId, targetNodeId: name.slice(i + 1) as NodeId };
}

// Fast validity checks (no allocations or slicing on success path)
export function isValidWorkingCopyHolderName(name: string): boolean {
  const i = name.indexOf(SEP);
  return i > 0 && i < name.length - 1;
}

// Trash holder encoding: `${originalParentNodeId}\t${trashedNodeId}`
// Rationale: do not embed original name (can contain TAB and is mutable). Use child node.name on restore.
export function encodeTrashHolderName(originalParentNodeId: NodeId, trashedNodeId: NodeId): string {
  assertNoTab(originalParentNodeId, 'originalParentNodeId');
  assertNoTab(trashedNodeId, 'trashedNodeId');
  return `${originalParentNodeId}${SEP}${trashedNodeId}`;
}

export function decodeTrashHolderName(name: string): { originalParentNodeId: NodeId; trashedNodeId: NodeId } {
  const i = name.indexOf(SEP);
  if (i <= 0 || i >= name.length - 1) throw new Error('Invalid trash holder name');
  return { originalParentNodeId: name.slice(0, i) as NodeId, trashedNodeId: name.slice(i + 1) as NodeId };
}

export function isValidTrashHolderName(name: string): boolean {
  const i = name.indexOf(SEP);
  return i > 0 && i < name.length - 1;
}
