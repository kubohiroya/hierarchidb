import Dexie from 'dexie';
import { getDBName } from './db-name.js';

/**
 * Open a Dexie database using the shared naming convention.
 * Suffix should be kebab-case without prefix; project/app prefixes are applied by getDBName.
 */
export function openNamedDexie(dbSuffix: string): Dexie {
  return new Dexie(getDBName(dbSuffix));
}

/** Light-weight, optional session record shape useful for ephemeral stores */
export interface EphemeralSessionRecord {
  sessionId: string;
  createdAt: number;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
}
