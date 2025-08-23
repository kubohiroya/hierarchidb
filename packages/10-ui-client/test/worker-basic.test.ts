/**
 * Basic Worker functionality test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WorkerAPIClient } from '../src/client/WorkerAPIClient';

describe('WorkerAPIClient Basic Tests', () => {
  let client: WorkerAPIClient | null = null;

  beforeAll(async () => {
    // Initialize the WorkerAPIClient
    client = await WorkerAPIClient.getSingleton();
  });

  afterAll(async () => {
    // Cleanup
    if (client) {
      await client.cleanup();
    }
  });

  it('should initialize WorkerAPIClient', () => {
    expect(client).toBeTruthy();
  });

  it('should ping worker successfully', async () => {
    if (!client) throw new Error('Client not initialized');

    const result = await client.ping();
    expect(result).toBe(true);
  });

  it('should get API proxy', () => {
    if (!client) throw new Error('Client not initialized');

    const api = client.getAPI();
    expect(api).toBeTruthy();
  });

  it('should call getTrees without error', async () => {
    if (!client) throw new Error('Client not initialized');

    const api = client.getAPI();
    const trees = await api.getTrees();

    // Should return an array (even if empty)
    expect(Array.isArray(trees)).toBe(true);
  });
});
