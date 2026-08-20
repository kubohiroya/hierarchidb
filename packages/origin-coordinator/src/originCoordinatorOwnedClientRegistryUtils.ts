import type { OriginCoordinatorOwnedClientHandle } from './types.js';

const ownedClientHandles = new Set<OriginCoordinatorOwnedClientHandle>();
let ownedClientCreationRevoked = false;

export function assertOriginCoordinatorOwnedClientCreationAllowed(): void {
  if (ownedClientCreationRevoked) {
    throw new Error('origin-coordinator-owned-client-creation-revoked');
  }
}

export function registerOriginCoordinatorOwnedClientHandle(
  handle: OriginCoordinatorOwnedClientHandle
): () => void {
  assertOriginCoordinatorOwnedClientCreationAllowed();
  ownedClientHandles.add(handle);
  return () => {
    ownedClientHandles.delete(handle);
  };
}

export async function revokeOriginCoordinatorOwnedClientHandles(): Promise<void> {
  ownedClientCreationRevoked = true;
  let closeFailed = false;
  for (const handle of [...ownedClientHandles]) {
    try {
      await handle.close();
      ownedClientHandles.delete(handle);
    } catch {
      closeFailed = true;
    }
  }
  if (closeFailed) throw new Error('origin-coordinator-owned-client-close-failed');
}
