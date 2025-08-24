import type { Timestamp } from '../types/base';

export function getCurrentTimestamp(): Timestamp {
  return Date.now();
}
