import { Dexie } from 'dexie';
import { getDBName } from '@hierarchidb/util';

export async function clearDatabases(): Promise<void> {
  await Dexie.delete(getDBName('location-entities-db'));
  await Dexie.delete(getDBName('location-ephemeral-db'));
}
