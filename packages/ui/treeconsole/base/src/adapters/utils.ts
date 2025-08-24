/**
 * TreeConsole APIアダプター ユーティリティ関数
 *
 * 新旧APIの変換に必要な基盤ツールを提供します。
 * CommandEnvelope生成とstring生成のヘルパー関数を含みます。
 */

// Use native crypto.randomUUID() instead of uuid package
import type { CommandEnvelope, Timestamp, OnNameConflict } from '@hierarchidb/common-core';
/**
 * CommandEnvelope生成ヘルパー
 *
 * 既存テストコードのパターンに基づいてCommandEnvelopeを生成します。
 * TreeObservableService.test.tsのコマンド作成パターンを参考にしています。
 */
export function createCommand<K extends string, P>(
  kind: K,
  payload: P,
  options?: {
    groupId?: string;
    sourceViewId?: string;
    onNameConflict?: OnNameConflict;
  }
): CommandEnvelope<K, P> {
  return {
    commandId: crypto.randomUUID(),
    groupId: options?.groupId || crypto.randomUUID(),
    kind,
    payload,
    issuedAt: Date.now() as Timestamp,
    sourceViewId: options?.sourceViewId,
    onNameConflict: options?.onNameConflict || 'auto-rename',
  };
}

/**
 * アダプターコンテキスト用のstring生成
 */
export function createAdapterGroupId(): string {
  return crypto.randomUUID();
}

export function createAdapterCommandId(): string {
  return crypto.randomUUID();
}

/**
 * タイムスタンプ生成ヘルパー
 */
export function createTimestamp(): Timestamp {
  return Date.now() as Timestamp;
}
