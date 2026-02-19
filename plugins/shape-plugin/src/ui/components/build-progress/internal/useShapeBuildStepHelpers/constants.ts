import { type NodeType, toNodeType } from '@hierarchidb/core-types';

export const SHAPE_NODE_TYPE = toNodeType('shape') satisfies NodeType;
export const PAUSE_COMMAND_TIMEOUT_MS = 60_000;
export const UI_POLL_INTERVAL_MS = 3000;
export const UI_QUIET_THRESHOLD_MS = 5000;
