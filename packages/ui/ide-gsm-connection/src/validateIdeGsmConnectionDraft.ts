import type {
  IdeGsmConnectionDraft,
  IdeGsmConnectionInput,
  IdeGsmConnectionRuntimeProvider,
  IdeGsmConnectionValidationResult,
} from './ideGsmConnectionTypes.js';

export async function validateIdeGsmConnectionDraft(
  draft: IdeGsmConnectionDraft,
  provider: IdeGsmConnectionRuntimeProvider
): Promise<IdeGsmConnectionValidationResult> {
  if (draft.manualTargetEnabled) {
    if (!provider.resolveManualTarget) {
      return { ok: false, code: 'MANUAL_TARGET_UNAVAILABLE' };
    }
    const resolved = await provider.resolveManualTarget({
      manualHost: draft.manualHost,
      manualPort: draft.manualPort,
      useCorsProxy: draft.useCorsProxy,
    });
    if (resolved.connectionName.length === 0) {
      return { ok: false, code: 'CONNECTION_UNAVAILABLE' };
    }
    return { ok: true, value: { connectionName: resolved.connectionName } };
  }

  if (draft.connectionName.length === 0) {
    return { ok: false, code: 'CONNECTION_NAME_REQUIRED' };
  }

  const connections = await provider.listConnections();
  const found = connections.some((connection) => connection.name === draft.connectionName);
  if (!found) {
    return { ok: false, code: 'CONNECTION_UNAVAILABLE' };
  }

  const value: IdeGsmConnectionInput = { connectionName: draft.connectionName };
  return { ok: true, value };
}
