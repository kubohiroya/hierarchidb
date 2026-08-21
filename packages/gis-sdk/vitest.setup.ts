/**
 * gis-sdk test setup
 * Only imports fake-indexeddb; does NOT run clearAllDatabases() globally
 * because each test manages its own EphemeralDB lifecycle via beforeEach/afterEach.
 */
import 'fake-indexeddb/auto';
import '../../vitest.database-prefix.setup.ts';
