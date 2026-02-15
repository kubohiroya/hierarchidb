export type KvWarningOperation = 'login' | 'refresh' | 'revoke' | 'logout';
export type KvWarningAction = 'none' | 'relogin';
export type KvWarningReason = 'missing_kv' | 'kv_error';

export type KvWarning = {
  code: 'kv_unavailable';
  operation: KvWarningOperation;
  action: KvWarningAction;
  reason: KvWarningReason;
};

export const buildKvWarning = (
  operation: KvWarningOperation,
  reason: KvWarningReason,
  action: KvWarningAction
): KvWarning => ({
  code: 'kv_unavailable',
  operation,
  action,
  reason,
});
