export * from '@hierarchidb/location-api';
export {
  LocationDB,
  closeLocationDB,
  clearLocationDatabases,
  clearLocationDatabases as clearDatabases,
  getLocationDB,
  getLocationDatabase,
  LocationDatabase,
  closeEphemeralLocationDB,
  getEphemeralLocationDB,
} from './LocationDB.js';
