// Minimal stub for dialog display mode persistence used only in tests.
// Real app wires this to a Dexie-backed store. For unit tests, keep it simple.

type Mode = 'standard' | 'maximized' | 'fullscreen';
const mem = new Map<string, Mode>();

export async function getPeerDisplayMode(nodeType: string, nodeId: string): Promise<Mode | undefined> {
  return mem.get(`${nodeType}:${nodeId}`);
}

export async function setPeerDisplayMode(nodeType: string, nodeId: string, mode: Mode): Promise<void> {
  mem.set(`${nodeType}:${nodeId}`, mode);
}

