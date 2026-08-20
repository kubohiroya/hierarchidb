export type BffWarningOperation = 'login' | 'refresh' | 'revoke' | 'logout';
export type BffWarningAction = 'none' | 'relogin';
export type BffWarningReason = 'missing_kv' | 'kv_error';

export type BffWarning = {
  code: 'kv_unavailable';
  operation: BffWarningOperation;
  action: BffWarningAction;
  reason: BffWarningReason;
};

export const BFF_WARNING_EVENT = 'hierarchidb:bff-warning';

const isBffWarningOperation = (value: unknown): value is BffWarningOperation =>
  value === 'login' || value === 'refresh' || value === 'revoke' || value === 'logout';

const isBffWarningAction = (value: unknown): value is BffWarningAction =>
  value === 'none' || value === 'relogin';

const isBffWarningReason = (value: unknown): value is BffWarningReason =>
  value === 'missing_kv' || value === 'kv_error';

export const isBffWarning = (value: unknown): value is BffWarning => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.code === 'kv_unavailable' &&
    isBffWarningOperation(candidate.operation) &&
    isBffWarningAction(candidate.action) &&
    isBffWarningReason(candidate.reason)
  );
};

export const emitBffWarning = (warning: BffWarning): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BFF_WARNING_EVENT, { detail: warning }));
};

export const maybeEmitBffWarning = (payload: unknown): BffWarning | null => {
  if (!isBffWarning(payload)) return null;
  emitBffWarning(payload);
  return payload;
};

export const readWarningFromResponse = async (response: Response): Promise<BffWarning | null> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  try {
    const data = await response.clone().json();
    return maybeEmitBffWarning((data as { warning?: unknown })?.warning);
  } catch {
    return null;
  }
};
