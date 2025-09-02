import { Timestamp } from '@hierarchidb/common-type';

export function getCurrentTimestamp(): Timestamp {
  return Date.now();
}
