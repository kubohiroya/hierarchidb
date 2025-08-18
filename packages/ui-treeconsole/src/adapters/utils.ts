/**
 * TreeConsole APIアダプター ユーティリティ関数
 * 
 * 新旧APIの変換に必要な基盤ツールを提供します。
 * CommandEnvelope生成とUUID生成のヘルパー関数を含みます。
 */

import { generateUUID } from '@hierarchidb/core';
import type { 
  CommandEnvelope, 
  UUID, 
  Timestamp,
  OnNameConflict 
} from '@hierarchidb/core';

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
    groupId?: UUID;
    sourceViewId?: string;
    onNameConflict?: OnNameConflict;
  }
): CommandEnvelope<K, P> {
  return {
    commandId: generateUUID(),
    groupId: options?.groupId || generateUUID(),
    kind,
    payload,
    issuedAt: Date.now() as Timestamp,
    sourceViewId: options?.sourceViewId,
    onNameConflict: options?.onNameConflict || 'auto-rename'
  };
}

/**
 * アダプターコンテキスト用のUUID生成
 */
export function createAdapterGroupId(): UUID {
  return generateUUID();
}

export function createAdapterCommandId(): UUID {
  return generateUUID();
}

/**
 * タイムスタンプ生成ヘルパー
 */
export function createTimestamp(): Timestamp {
  return Date.now() as Timestamp;
}