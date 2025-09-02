// Maps worker CommandResult codes to user-facing messages (Japanese)
// This is UI-only; do not import from worker to avoid coupling.

export type CommandErrorCode =
  | 'COMMIT_CONFLICT'
  | 'NAME_CONFLICT'
  | 'NODE_NOT_FOUND'
  | 'ILLEGAL_RELATION'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'INVALID_OPERATION'
  | 'UNKNOWN_ERROR';

export function mapCommandErrorToMessage(code: CommandErrorCode): {
  message: string;
  severity: 'error' | 'warning' | 'info';
} {
  switch (code) {
    case 'COMMIT_CONFLICT':
      return { message: '保存に競合が発生しました。内容を確認して再試行してください。', severity: 'warning' };
    case 'NAME_CONFLICT':
      return { message: '同名の項目が既に存在します。名前を変更してください。', severity: 'warning' };
    case 'NODE_NOT_FOUND':
      return { message: '対象の項目が見つかりません。画面を更新してください。', severity: 'warning' };
    case 'ILLEGAL_RELATION':
      return { message: '不正な移動です（循環参照は許可されていません）。', severity: 'warning' };
    case 'VALIDATION_ERROR':
      return { message: '入力内容に問題があります。値を見直してください。', severity: 'warning' };
    case 'DATABASE_ERROR':
      return { message: '内部エラーが発生しました。しばらくしてから再試行してください。', severity: 'error' };
    case 'INVALID_OPERATION':
      return { message: 'この操作は現在許可されていません。', severity: 'warning' };
    default:
      return { message: '不明なエラーが発生しました。', severity: 'error' };
  }
}

import { notify } from '@hierarchidb/ui-core';

export function showCommandError(code: CommandErrorCode, fallback?: string) {
  const { message, severity } = mapCommandErrorToMessage(code);
  if (severity === 'warning') {
    notify.warning(fallback ?? message);
  } else if (severity === 'info') {
    notify.info(fallback ?? message);
  } else {
    notify.error(fallback ?? message);
  }
}
