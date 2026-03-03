import { type NodeType, toNodeType } from '@hierarchidb/core-types';

export const SHAPE_NODE_TYPE = toNodeType('shape') satisfies NodeType;
export const PAUSE_COMMAND_TIMEOUT_MS = 30_000; // 30秒に短縮
export const PAUSE_STATE_SYNC_TIMEOUT_MS = 10_000; // セッション状態同期のタイムアウト
export const UI_QUIET_THRESHOLD_MS = 5000;
