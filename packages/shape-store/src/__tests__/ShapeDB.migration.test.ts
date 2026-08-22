/**
 * ShapeDB Migration Test
 *
 * Tests the migration from version 1 (monolithic sessions table) to version 2
 * (four normalized tables: buildSessionConfigs, buildSessionHeartbeats, buildSessionStatuses, buildStageStatuses)
 */

import type { NodeId } from '@hierarchidb/core-types';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ShapeDB } from '../ShapeDB';
import type { BuildSessionRecord } from '../VectorTileRecord';

type MigrationTestDB = Dexie &
  Pick<
    ShapeDB,
    | 'vectorTiles'
    | 'tileSummaries'
    | 'tabularMetadata'
    | 'buildSessionConfigs'
    | 'buildSessionHeartbeats'
    | 'buildSessionStatuses'
    | 'buildStageStatuses'
  >;

describe('ShapeDB Migration from V1 to V2', () => {
  let testDbName: string;
  let db: MigrationTestDB | undefined;

  beforeEach(() => {
    // Use unique database name for each test
    testDbName = `test-shape-db-${Date.now()}-${Math.random()}`;
  });

  afterEach(async () => {
    // Clean up test database
    if (db) {
      db.close();
    }
    await Dexie.delete(testDbName);
  });

  it('should migrate old session records to new four-table structure', async () => {
    // Step 1: Create a V1 database with old schema
    const dbV1 = new Dexie(testDbName);
    dbV1.version(1).stores({
      sessions: '&nodeId',
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
      tileSummaries: '&nodeId',
      featureMetadata: '&id, nodeId',
      sourceMetadata: '&id, nodeId',
      tabularMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
    });

    await dbV1.open();

    // Step 2: Insert old session records
    const oldSession1: BuildSessionRecord = {
      nodeId: 'node-1' as NodeId,
      status: 'running',
      selectedArrayByCountries: { US: [true, false], CA: [true, true] },
      startedAt: 1000000,
      updatedAt: 1000100,
      lastHeartbeatAt: 1000200,
      stage: 'source',
      stageStartedAt: 1000050,
      stageInactiveMs: 500,
      stageId: 'stage-source-1',
      progress: {
        total: 100,
        completed: 50,
        failed: 0,
        skipped: 0,
        percentage: 50,
      },
      stages: {
        source: {
          status: 'running',
          progress: 50,
          tasksTotal: 100,
          tasksCompleted: 50,
          tasksFailed: 0,
        },
        geometry: {
          status: 'queued',
          progress: 0,
          tasksTotal: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
        },
        tileEmit: {
          status: 'queued',
          progress: 0,
          tasksTotal: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
        },
      },
      sourceStageMaxima: {
        featureMax: 1000,
        polygonMax: 500,
      },
    };

    const oldSession2: BuildSessionRecord = {
      nodeId: 'node-2' as NodeId,
      status: 'completed',
      selectedArrayByCountries: { UK: [true, true, false] },
      startedAt: 2000000,
      updatedAt: 2000500,
      completedAt: 2000500,
      lastHeartbeatAt: 2000450,
      stage: 'tileEmit',
      stageStartedAt: 2000400,
      stopReason: 'completed',
      progress: {
        total: 50,
        completed: 50,
        failed: 0,
        skipped: 0,
        percentage: 100,
      },
      stages: {
        source: {
          status: 'completed',
          progress: 100,
          tasksTotal: 20,
          tasksCompleted: 20,
          tasksFailed: 0,
        },
        geometry: {
          status: 'completed',
          progress: 100,
          tasksTotal: 20,
          tasksCompleted: 20,
          tasksFailed: 0,
        },
        tileEmit: {
          status: 'completed',
          progress: 100,
          tasksTotal: 10,
          tasksCompleted: 10,
          tasksFailed: 0,
        },
      },
    };

    await dbV1.table('sessions').add(oldSession1);
    await dbV1.table('sessions').add(oldSession2);

    // Verify old records exist
    const oldRecords = await dbV1.table('sessions').toArray();
    expect(oldRecords).toHaveLength(2);

    dbV1.close();

    // Step 3: Open database with V2 schema (triggers migration)
    // Create a custom ShapeDB class that uses our test database name
    class TestShapeDB extends Dexie {
      vectorTiles!: ShapeDB['vectorTiles'];
      tileSummaries!: ShapeDB['tileSummaries'];
      tabularMetadata!: ShapeDB['tabularMetadata'];
      buildSessionConfigs!: ShapeDB['buildSessionConfigs'];
      buildSessionHeartbeats!: ShapeDB['buildSessionHeartbeats'];
      buildSessionStatuses!: ShapeDB['buildSessionStatuses'];
      buildStageStatuses!: ShapeDB['buildStageStatuses'];

      constructor() {
        super(testDbName);

        // Version 1: Original schema
        this.version(1).stores({
          sessions: '&nodeId',
          vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
          tileSummaries: '&nodeId',
          featureMetadata: '&id, nodeId',
          sourceMetadata: '&id, nodeId',
          tabularMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
        });

        // Version 2: Refactored schema with migration
        this.version(2)
          .stores({
            vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
            tileSummaries: '&nodeId',
            featureMetadata: '&id, nodeId',
            sourceMetadata: '&id, nodeId',
            tabularMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
            buildSessionConfigs: '&nodeId',
            buildSessionHeartbeats: '&nodeId',
            buildSessionStatuses: '&nodeId, status',
            buildStageStatuses: '&id, nodeId, [nodeId+stage], [nodeId+startedAt]',
            sessions: null, // Remove old sessions table
          })
          .upgrade(async (tx) => {
            // Migration logic: Transform old BuildSessionRecord into four new tables
            const tableNames = Array.from(tx.idbtrans.objectStoreNames);
            if (!tableNames.includes('sessions')) {
              return;
            }

            const oldSessionsTable = tx.idbtrans.objectStore('sessions');
            const oldSessions: BuildSessionRecord[] = [];
            const cursorRequest = oldSessionsTable.openCursor();

            await new Promise<void>((resolve, reject) => {
              cursorRequest.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                  oldSessions.push(cursor.value as BuildSessionRecord);
                  cursor.continue();
                } else {
                  resolve();
                }
              };
              cursorRequest.onerror = () => reject(cursorRequest.error);
            });

            // Transform each old session into four new table records
            for (const old of oldSessions) {
              // 1. Create BuildSessionRecord (immutable config)
              await tx.table('buildSessionConfigs').add({
                nodeId: old.nodeId,
                domainType: 'shape',
                selectedArrayByCountries: old.selectedArrayByCountries,
                selectedArrayVersion: undefined,
                startedAt: old.startedAt,
                sourceStageMaxima: old.sourceStageMaxima,
              });

              // 2. Create BuildSessionHeartbeat (if lastHeartbeatAt exists)
              if (old.lastHeartbeatAt !== undefined) {
                await tx.table('buildSessionHeartbeats').add({
                  nodeId: old.nodeId,
                  lastHeartbeatAt: old.lastHeartbeatAt,
                });
              }

              // 3. Create BuildSessionStatus (session-level status)
              await tx.table('buildSessionStatuses').add({
                nodeId: old.nodeId,
                status: old.status,
                stopReason: old.stopReason,
                completedAt: old.completedAt,
              });

              // 4. Create BuildStageStatus (current stage only)
              if (old.stage) {
                await tx.table('buildStageStatuses').add({
                  id: `${old.nodeId}:${old.stage}`,
                  nodeId: old.nodeId,
                  stage: old.stage,
                  status: old.status === 'running' ? 'running' : 'completed',
                  startedAt: old.stageStartedAt ?? old.startedAt,
                  completedAt: old.status === 'completed' ? old.completedAt : undefined,
                  inactiveMs: old.stageInactiveMs,
                  stageId: old.stageId,
                });
              }
            }
          });

        this.buildSessionConfigs = this.table('buildSessionConfigs');
        this.buildSessionHeartbeats = this.table('buildSessionHeartbeats');
        this.buildSessionStatuses = this.table('buildSessionStatuses');
        this.buildStageStatuses = this.table('buildStageStatuses');
      }
    }

    db = new TestShapeDB();
    await db.open();

    // Step 4: Verify migration results

    // Check buildSessionConfigs table (immutable config)
    const sessions = await db.buildSessionConfigs.toArray();
    expect(sessions).toHaveLength(2);

    const session1 = sessions.find((s) => s.nodeId === 'node-1');
    expect(session1).toBeDefined();
    expect(session1?.nodeId).toBe('node-1');
    expect(session1?.domainType).toBe('shape');
    expect(session1?.selectedArrayByCountries).toEqual({ US: [true, false], CA: [true, true] });
    expect(session1?.startedAt).toBe(1000000);
    expect(session1?.sourceStageMaxima).toEqual({ featureMax: 1000, polygonMax: 500 });

    const session2 = sessions.find((s) => s.nodeId === 'node-2');
    expect(session2).toBeDefined();
    expect(session2?.nodeId).toBe('node-2');
    expect(session2?.selectedArrayByCountries).toEqual({ UK: [true, true, false] });
    expect(session2?.startedAt).toBe(2000000);

    // Check buildSessionHeartbeats table
    const heartbeats = await db.buildSessionHeartbeats.toArray();
    expect(heartbeats).toHaveLength(2);

    const heartbeat1 = heartbeats.find((h) => h.nodeId === 'node-1');
    expect(heartbeat1).toBeDefined();
    expect(heartbeat1?.lastHeartbeatAt).toBe(1000200);

    const heartbeat2 = heartbeats.find((h) => h.nodeId === 'node-2');
    expect(heartbeat2).toBeDefined();
    expect(heartbeat2?.lastHeartbeatAt).toBe(2000450);

    // Check buildSessionStatuses table
    const statuses = await db.buildSessionStatuses.toArray();
    expect(statuses).toHaveLength(2);

    const status1 = statuses.find((s) => s.nodeId === 'node-1');
    expect(status1).toBeDefined();
    expect(status1?.status).toBe('running');
    expect(status1?.stopReason).toBeUndefined();
    expect(status1?.completedAt).toBeUndefined();

    const status2 = statuses.find((s) => s.nodeId === 'node-2');
    expect(status2).toBeDefined();
    expect(status2?.status).toBe('completed');
    expect(status2?.stopReason).toBe('completed');
    expect(status2?.completedAt).toBe(2000500);

    // Check buildStageStatuses table
    const stageStatuses = await db.buildStageStatuses.toArray();
    expect(stageStatuses).toHaveLength(2);

    const stageStatus1 = stageStatuses.find((s) => s.nodeId === 'node-1');
    expect(stageStatus1).toBeDefined();
    expect(stageStatus1?.id).toBe('node-1:source');
    expect(stageStatus1?.stage).toBe('source');
    expect(stageStatus1?.status).toBe('running');
    expect(stageStatus1?.startedAt).toBe(1000050);
    expect(stageStatus1?.inactiveMs).toBe(500);
    expect(stageStatus1?.stageId).toBe('stage-source-1');
    expect(stageStatus1?.completedAt).toBeUndefined();

    const stageStatus2 = stageStatuses.find((s) => s.nodeId === 'node-2');
    expect(stageStatus2).toBeDefined();
    expect(stageStatus2?.id).toBe('node-2:tileEmit');
    expect(stageStatus2?.stage).toBe('tileEmit');
    expect(stageStatus2?.status).toBe('completed');
    expect(stageStatus2?.startedAt).toBe(2000400);
    expect(stageStatus2?.completedAt).toBe(2000500);

    // Verify old sessions table no longer exists
    const tableNames = db.tables.map((t) => t.name);
    expect(tableNames).not.toContain('sessions');
    expect(tableNames).toContain('buildSessionConfigs');
    expect(tableNames).toContain('buildSessionHeartbeats');
    expect(tableNames).toContain('buildSessionStatuses');
    expect(tableNames).toContain('buildStageStatuses');
  });

  it('should handle migration when no old sessions exist', async () => {
    // Step 1: Create a V1 database with no session records
    const dbV1 = new Dexie(testDbName);
    dbV1.version(1).stores({
      sessions: '&nodeId',
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
      tileSummaries: '&nodeId',
      featureMetadata: '&id, nodeId',
      sourceMetadata: '&id, nodeId',
      tabularMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
    });

    await dbV1.open();
    dbV1.close();

    // Step 2: Open database with V2 schema (triggers migration)
    db = new ShapeDB(testDbName);
    await db.open();

    // Step 3: Verify new tables are empty
    const sessions = await db.buildSessionConfigs.toArray();
    expect(sessions).toHaveLength(0);

    const heartbeats = await db.buildSessionHeartbeats.toArray();
    expect(heartbeats).toHaveLength(0);

    const statuses = await db.buildSessionStatuses.toArray();
    expect(statuses).toHaveLength(0);

    const stageStatuses = await db.buildStageStatuses.toArray();
    expect(stageStatuses).toHaveLength(0);
  });

  it('should handle session without lastHeartbeatAt', async () => {
    // Step 1: Create a V1 database
    const dbV1 = new Dexie(testDbName);
    dbV1.version(1).stores({
      sessions: '&nodeId',
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
      tileSummaries: '&nodeId',
      featureMetadata: '&id, nodeId',
      sourceMetadata: '&id, nodeId',
      tabularMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
    });

    await dbV1.open();

    // Session without lastHeartbeatAt
    const oldSession: BuildSessionRecord = {
      nodeId: 'node-3' as NodeId,
      status: 'idle',
      startedAt: 3000000,
      updatedAt: 3000000,
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
      stages: {
        source: {
          status: 'queued',
          progress: 0,
          tasksTotal: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
        },
        geometry: {
          status: 'queued',
          progress: 0,
          tasksTotal: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
        },
        tileEmit: {
          status: 'queued',
          progress: 0,
          tasksTotal: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
        },
      },
    };

    await dbV1.table('sessions').add(oldSession);
    dbV1.close();

    // Step 2: Open with V2 schema (triggers migration)
    class TestShapeDB extends Dexie {
      vectorTiles!: ShapeDB['vectorTiles'];
      tileSummaries!: ShapeDB['tileSummaries'];
      tabularMetadata!: ShapeDB['tabularMetadata'];
      buildSessionConfigs!: ShapeDB['buildSessionConfigs'];
      buildSessionHeartbeats!: ShapeDB['buildSessionHeartbeats'];
      buildSessionStatuses!: ShapeDB['buildSessionStatuses'];
      buildStageStatuses!: ShapeDB['buildStageStatuses'];

      constructor() {
        super(testDbName);

        // Version 1: Original schema
        this.version(1).stores({
          sessions: '&nodeId',
          vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
          tileSummaries: '&nodeId',
          featureMetadata: '&id, nodeId',
          sourceMetadata: '&id, nodeId',
          tabularMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
        });

        // Version 2: Refactored schema with migration (same as ShapeDB)
        this.version(2)
          .stores({
            vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
            tileSummaries: '&nodeId',
            featureMetadata: '&id, nodeId',
            sourceMetadata: '&id, nodeId',
            tabularMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
            buildSessionConfigs: '&nodeId',
            buildSessionHeartbeats: '&nodeId',
            buildSessionStatuses: '&nodeId, status',
            buildStageStatuses: '&id, nodeId, [nodeId+stage], [nodeId+startedAt]',
            sessions: null,
          })
          .upgrade(async (tx) => {
            const tableNames = Array.from(tx.idbtrans.objectStoreNames);
            if (!tableNames.includes('sessions')) {
              return;
            }

            const oldSessionsTable = tx.idbtrans.objectStore('sessions');
            const oldSessions: BuildSessionRecord[] = [];
            const cursorRequest = oldSessionsTable.openCursor();

            await new Promise<void>((resolve, reject) => {
              cursorRequest.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                  oldSessions.push(cursor.value as BuildSessionRecord);
                  cursor.continue();
                } else {
                  resolve();
                }
              };
              cursorRequest.onerror = () => reject(cursorRequest.error);
            });

            for (const old of oldSessions) {
              await tx.table('buildSessionConfigs').add({
                nodeId: old.nodeId,
                domainType: 'shape',
                selectedArrayByCountries: old.selectedArrayByCountries,
                selectedArrayVersion: undefined,
                startedAt: old.startedAt,
                sourceStageMaxima: old.sourceStageMaxima,
              });

              if (old.lastHeartbeatAt !== undefined) {
                await tx.table('buildSessionHeartbeats').add({
                  nodeId: old.nodeId,
                  lastHeartbeatAt: old.lastHeartbeatAt,
                });
              }

              await tx.table('buildSessionStatuses').add({
                nodeId: old.nodeId,
                status: old.status,
                stopReason: old.stopReason,
                completedAt: old.completedAt,
              });

              if (old.stage) {
                await tx.table('buildStageStatuses').add({
                  id: `${old.nodeId}:${old.stage}`,
                  nodeId: old.nodeId,
                  stage: old.stage,
                  status: old.status === 'running' ? 'running' : 'completed',
                  startedAt: old.stageStartedAt ?? old.startedAt,
                  completedAt: old.status === 'completed' ? old.completedAt : undefined,
                  inactiveMs: old.stageInactiveMs,
                  stageId: old.stageId,
                });
              }
            }
          });

        this.buildSessionConfigs = this.table('buildSessionConfigs');
        this.buildSessionHeartbeats = this.table('buildSessionHeartbeats');
        this.buildSessionStatuses = this.table('buildSessionStatuses');
        this.buildStageStatuses = this.table('buildStageStatuses');
      }
    }

    db = new TestShapeDB();
    await db.open();

    // Step 3: Verify migration
    const sessions = await db.buildSessionConfigs.toArray();
    expect(sessions).toHaveLength(1);

    // No heartbeat record should be created
    const heartbeats = await db.buildSessionHeartbeats.toArray();
    expect(heartbeats).toHaveLength(0);

    const statuses = await db.buildSessionStatuses.toArray();
    expect(statuses).toHaveLength(1);
    expect(statuses[0].status).toBe('idle');

    // No stage status since no stage was set
    const stageStatuses = await db.buildStageStatuses.toArray();
    expect(stageStatuses).toHaveLength(0);
  });

  it('should discard computed and unused fields during migration', async () => {
    // Step 1: Create a V1 database
    const dbV1 = new Dexie(testDbName);
    dbV1.version(1).stores({
      sessions: '&nodeId',
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
      tileSummaries: '&nodeId',
      featureMetadata: '&id, nodeId',
      sourceMetadata: '&id, nodeId',
      tabularMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
    });

    await dbV1.open();

    // Session with all the fields that should be discarded
    const oldSession: BuildSessionRecord = {
      nodeId: 'node-4' as NodeId,
      status: 'running',
      startedAt: 4000000,
      updatedAt: 4000100,
      lastHeartbeatAt: 4000200,
      stage: 'geometry',
      stageStartedAt: 4000150,
      // Computed fields (should be discarded)
      progress: {
        total: 100,
        completed: 25,
        failed: 5,
        skipped: 10,
        percentage: 25,
      },
      stages: {
        source: {
          status: 'completed',
          progress: 100,
          tasksTotal: 50,
          tasksCompleted: 50,
          tasksFailed: 0,
        },
        geometry: {
          status: 'running',
          progress: 50,
          tasksTotal: 50,
          tasksCompleted: 25,
          tasksFailed: 5,
        },
        tileEmit: {
          status: 'queued',
          progress: 0,
          tasksTotal: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
        },
      },
      // Unused fields (should be discarded)
      resourceUsage: {
        memoryUsed: 1000000,
        memoryPeak: 2000000,
        cpuPercent: 50,
        storageUsed: 5000000,
        networkBytesReceived: 100000,
        networkBytesSent: 50000,
      },
      canResume: true,
      lastActivity: 4000200,
      expiresAt: 5000000,
      stageHeartbeatAt: 4000200,
    };

    await dbV1.table('sessions').add(oldSession);
    dbV1.close();

    // Step 2: Open with V2 schema (triggers migration)
    class TestShapeDB extends Dexie {
      vectorTiles!: ShapeDB['vectorTiles'];
      tileSummaries!: ShapeDB['tileSummaries'];
      tabularMetadata!: ShapeDB['tabularMetadata'];
      buildSessionConfigs!: ShapeDB['buildSessionConfigs'];
      buildSessionHeartbeats!: ShapeDB['buildSessionHeartbeats'];
      buildSessionStatuses!: ShapeDB['buildSessionStatuses'];
      buildStageStatuses!: ShapeDB['buildStageStatuses'];

      constructor() {
        super(testDbName);

        // Version 1: Original schema
        this.version(1).stores({
          sessions: '&nodeId',
          vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
          tileSummaries: '&nodeId',
          featureMetadata: '&id, nodeId',
          sourceMetadata: '&id, nodeId',
          tabularMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
        });

        // Version 2: Refactored schema with migration (same as ShapeDB)
        this.version(2)
          .stores({
            vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
            tileSummaries: '&nodeId',
            featureMetadata: '&id, nodeId',
            sourceMetadata: '&id, nodeId',
            tabularMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
            buildSessionConfigs: '&nodeId',
            buildSessionHeartbeats: '&nodeId',
            buildSessionStatuses: '&nodeId, status',
            buildStageStatuses: '&id, nodeId, [nodeId+stage], [nodeId+startedAt]',
            sessions: null,
          })
          .upgrade(async (tx) => {
            const tableNames = Array.from(tx.idbtrans.objectStoreNames);
            if (!tableNames.includes('sessions')) {
              return;
            }

            const oldSessionsTable = tx.idbtrans.objectStore('sessions');
            const oldSessions: BuildSessionRecord[] = [];
            const cursorRequest = oldSessionsTable.openCursor();

            await new Promise<void>((resolve, reject) => {
              cursorRequest.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                  oldSessions.push(cursor.value as BuildSessionRecord);
                  cursor.continue();
                } else {
                  resolve();
                }
              };
              cursorRequest.onerror = () => reject(cursorRequest.error);
            });

            for (const old of oldSessions) {
              await tx.table('buildSessionConfigs').add({
                nodeId: old.nodeId,
                domainType: 'shape',
                selectedArrayByCountries: old.selectedArrayByCountries,
                selectedArrayVersion: undefined,
                startedAt: old.startedAt,
                sourceStageMaxima: old.sourceStageMaxima,
              });

              if (old.lastHeartbeatAt !== undefined) {
                await tx.table('buildSessionHeartbeats').add({
                  nodeId: old.nodeId,
                  lastHeartbeatAt: old.lastHeartbeatAt,
                });
              }

              await tx.table('buildSessionStatuses').add({
                nodeId: old.nodeId,
                status: old.status,
                stopReason: old.stopReason,
                completedAt: old.completedAt,
              });

              if (old.stage) {
                await tx.table('buildStageStatuses').add({
                  id: `${old.nodeId}:${old.stage}`,
                  nodeId: old.nodeId,
                  stage: old.stage,
                  status: old.status === 'running' ? 'running' : 'completed',
                  startedAt: old.stageStartedAt ?? old.startedAt,
                  completedAt: old.status === 'completed' ? old.completedAt : undefined,
                  inactiveMs: old.stageInactiveMs,
                  stageId: old.stageId,
                });
              }
            }
          });

        this.buildSessionConfigs = this.table('buildSessionConfigs');
        this.buildSessionHeartbeats = this.table('buildSessionHeartbeats');
        this.buildSessionStatuses = this.table('buildSessionStatuses');
        this.buildStageStatuses = this.table('buildStageStatuses');
      }
    }

    db = new TestShapeDB();
    await db.open();

    // Step 3: Verify discarded fields are not in new tables
    const sessions = await db.buildSessionConfigs.toArray();
    expect(sessions).toHaveLength(1);
    const session = sessions[0];

    // Verify only immutable config fields are present
    expect(session).toHaveProperty('nodeId');
    expect(session).toHaveProperty('domainType');
    expect(session).toHaveProperty('startedAt');
    expect(session).not.toHaveProperty('progress');
    expect(session).not.toHaveProperty('stages');
    expect(session).not.toHaveProperty('resourceUsage');
    expect(session).not.toHaveProperty('canResume');
    expect(session).not.toHaveProperty('lastActivity');
    expect(session).not.toHaveProperty('expiresAt');
    expect(session).not.toHaveProperty('updatedAt');
    expect(session).not.toHaveProperty('elapsedMs');
    expect(session).not.toHaveProperty('elapsedByStage');

    const heartbeats = await db.buildSessionHeartbeats.toArray();
    expect(heartbeats).toHaveLength(1);
    const heartbeat = heartbeats[0];

    // Verify only heartbeat fields are present
    expect(heartbeat).toHaveProperty('nodeId');
    expect(heartbeat).toHaveProperty('lastHeartbeatAt');
    expect(heartbeat).not.toHaveProperty('stageHeartbeatAt');

    const statuses = await db.buildSessionStatuses.toArray();
    expect(statuses).toHaveLength(1);
    const status = statuses[0];

    // Verify only status fields are present
    expect(status).toHaveProperty('nodeId');
    expect(status).toHaveProperty('status');
    expect(status).not.toHaveProperty('updatedAt');

    const stageStatuses = await db.buildStageStatuses.toArray();
    expect(stageStatuses).toHaveLength(1);
    const stageStatus = stageStatuses[0];

    // Verify only stage status fields are present
    expect(stageStatus).toHaveProperty('id');
    expect(stageStatus).toHaveProperty('nodeId');
    expect(stageStatus).toHaveProperty('stage');
    expect(stageStatus).toHaveProperty('status');
    expect(stageStatus).toHaveProperty('startedAt');
    expect(stageStatus).not.toHaveProperty('progress');
    expect(stageStatus).not.toHaveProperty('tasksTotal');
    expect(stageStatus).not.toHaveProperty('tasksCompleted');
    expect(stageStatus).not.toHaveProperty('tasksFailed');
  });
});
