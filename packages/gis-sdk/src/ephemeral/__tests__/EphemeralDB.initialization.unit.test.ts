import { describe, expect, it } from 'vitest';
import { ephemeralDB, getEphemeralDB, initializeEphemeralDB } from '../EphemeralDB.js';

describe('EphemeralDB explicit initialization', () => {
  it('fails closed before initialization and rejects another database name', () => {
    expect(() => getEphemeralDB()).toThrow('ephemeral-database-not-initialized');
    expect(() => ephemeralDB.name).toThrow('ephemeral-database-not-initialized');
    expect(() => initializeEphemeralDB('')).toThrow('ephemeral-database-name-required');

    const database = initializeEphemeralDB('test-explicit-ephemeral');

    expect(getEphemeralDB()).toBe(database);
    expect(ephemeralDB.name).toBe('test-explicit-ephemeral');
    expect(() => initializeEphemeralDB('test-other-ephemeral')).toThrow(
      'ephemeral-database-name-mismatch'
    );
    database.close();
  });
});
