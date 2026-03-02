# Ephemeral Session Record Refactor Design

## Overview

This design refactors the monolithic `EphemeralBuildSessionRecord` into four distinct tables with clear responsibilities: immutable session configuration (`BuildSessionRecord`), heartbeat tracking (`BuildSessionHeartbeat`), session-level status (`BuildSessionStatus`), and per-stage status tracking (`BuildStageStatus`). This separation eliminates data duplication, removes unused fields, reduces serialization overhead, and preserves historical stage information.

The refactor applies to both EphemeralDB (volatile, cleared on startup) and ShapeDB (persistent). Since EphemeralDB is ephemeral, no migration is required—the new schema takes effect on next startup. ShapeDB requires a version bump and migration logic to transform existing records.

## Glossary

- **Bug_Condition (C)**: The condition where session records contain redundant, unused, or inefficiently-updated fields
- **Property (P)**: The desired behavior where session data is normalized into four tables with distinct update frequencies
- **Preservation**: Existing query patterns and external APIs that must remain unchanged
- **EphemeralBuildSessionRecord**: The current monolithic session record in `packages/gis-sdk/src/ephemeral/EphemeralBuildState.ts`
- **BuildSessionRecord**: New immutable configuration table (nodeId, domainType, selectedArrayByCountries, selectedArrayVersion, startedAt, sourceStageMaxima)
- **BuildSessionHeartbeat**: New heartbeat tracking table (nodeId, lastHeartbeatAt) updated every 1 second
- **BuildSessionStatus**: New session-level status table (nodeId, status, stopReason, completedAt) updated on state transitions
- **BuildStageStatus**: New per-stage status table (nodeId, stage, status, startedAt, completedAt, inactiveMs, stageId) preserving historical stage information
- **ShapeBuildSessionRecord**: The parallel structure in ShapeDB (`packages/shape-store/src/ShapeDB.ts`) that requires similar refactoring

## Bug Details

### Fault Condition

The bug manifests when session records are created or updated. The current `EphemeralBuildSessionRecord` mixes responsibilities with different update frequencies (immutable configuration, 1-second heartbeats, state transitions, per-stage tracking) in a single record, causing unnecessary serialization overhead and data loss.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SessionRecordOperation
  OUTPUT: boolean
  
  RETURN (input.operation == 'create' OR input.operation == 'update')
         AND input.record contains redundantFields(['selectedArrayByCountries', 'progress', 'stages'])
         AND input.record contains unusedFields(['expiresAt', 'canResume', 'resourceUsage'])
         AND input.record mixes updateFrequencies(['immutable', 'heartbeat', 'stateTransition', 'perStage'])
         AND input.operation == 'stageTransition' AND historicalStageData is lost
END FUNCTION
```

### Examples

- **Heartbeat Update**: When `lastHeartbeatAt` is updated every 1 second, the system serializes and deserializes the entire 2KB+ record including immutable `selectedArrayByCountries` and computed `progress`/`stages` fields
- **Stage Transition**: When transitioning from 'source' to 'geometry' stage, the system overwrites the `stage` field, losing the start time, completion time, and inactive duration of the 'source' stage
- **Session Creation**: When creating a new session, the system stores `progress` and `stages` even though these can be computed on-demand from `buildTasks` table queries
- **Unused Fields**: Fields like `expiresAt`, `canResume`, `lastActivity`, `updatedAt`, `elapsedMs`, `elapsedByStage`, `stageHeartbeatAt` are either unimplemented or derivable from other sources

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Existing query patterns for session status must continue to work through a unified query interface
- UI components displaying build progress must continue to receive the same information
- Session resume and cancel operations must continue to function with the same external API
- Session cleanup must continue to remove all related records atomically

**Scope:**
All code that queries session data through the existing API should be completely unaffected by this refactor. This includes:
- UI components reading session status
- Worker services updating session state
- Cleanup routines removing session data
- Progress calculation and display logic

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Monolithic Design**: The original `EphemeralBuildSessionRecord` was designed as a single record without considering update frequency patterns, leading to inefficient serialization

2. **Computed Fields Stored**: Fields like `progress` and `stages` are stored in the session record even though they can be computed from the `buildTasks` table, causing data duplication

3. **Stage History Loss**: Using a single `stage` field instead of a separate stage history table causes loss of historical stage information when transitioning between stages

4. **Unused Field Accumulation**: Over time, fields like `expiresAt`, `canResume`, `resourceUsage` were added but never fully implemented, creating technical debt

## Correctness Properties

Property 1: Fault Condition - Normalized Session Schema

_For any_ session record operation where the bug condition holds (creating or updating a session with redundant/unused fields), the fixed schema SHALL store only the minimal required data in four distinct tables: `BuildSessionRecord` (immutable config), `BuildSessionHeartbeat` (1-second updates), `BuildSessionStatus` (state transitions), and `BuildStageStatus` (per-stage tracking), eliminating redundancy and preserving historical stage information.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Query Interface Compatibility

_For any_ code that queries session data through the existing API, the fixed implementation SHALL provide the same information through a unified query interface that joins the four tables, preserving all existing query patterns and external APIs without requiring changes to calling code.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

The fix involves creating four new tables and migrating existing code to use them.

**Files to Modify**:
1. `packages/gis-sdk/src/ephemeral/EphemeralBuildState.ts` - Define new interfaces and schema
2. `packages/gis-sdk/src/ephemeral/EphemeralDB.ts` - Add new tables and migration logic
3. `packages/shape-store/src/ShapeDB.ts` - Apply parallel changes to ShapeDB
4. `packages/runtime-worker/src/services/ShapeMutationService.ts` - Update session write logic
5. `packages/runtime-worker/src/services/ShapeQueryService.ts` - Update session read logic
6. `plugins/shape-plugin/src/services/build/ShapeBuildAPIClient.ts` - Update API client
7. `plugins/shape-plugin/src/services/build/shapeSessionMappers.ts` - Update mapper functions

### New Schema Design

#### 1. BuildSessionRecord (Immutable Configuration)

Stores immutable session configuration data that never changes after creation.

```typescript
export interface BuildSessionRecord {
  nodeId: NodeId;
  domainType?: EphemeralDomainType;
  selectedArrayByCountries?: Record<string, boolean[]>;
  selectedArrayVersion?: string;
  startedAt: number;
  sourceStageMaxima?: EphemeralSourceStageMaxima;
}
```

**Dexie Schema:**
```typescript
buildSessions: '&nodeId'
```

**Update Frequency:** Once at creation, never updated

#### 2. BuildSessionHeartbeat (High-Frequency Updates)

Stores only the last heartbeat timestamp, updated every 1 second.

```typescript
export interface BuildSessionHeartbeat {
  nodeId: NodeId;
  lastHeartbeatAt: number;
}
```

**Dexie Schema:**
```typescript
buildSessionHeartbeats: '&nodeId'
```

**Update Frequency:** Every 1 second during active session

#### 3. BuildSessionStatus (State Transitions)

Stores session-level status that changes on state transitions.

```typescript
export interface BuildSessionStatus {
  nodeId: NodeId;
  status: BuildStatus;
  stopReason?: StopReason;
  completedAt?: number;
}
```

**Dexie Schema:**
```typescript
buildSessionStatuses: '&nodeId, status'
```

**Update Frequency:** On state transitions (idle → running → paused/completed/failed)

#### 4. BuildStageStatus (Per-Stage Tracking)

Stores per-stage status, creating a new record for each stage transition. This preserves historical stage information.

```typescript
export interface BuildStageStatus {
  id: string; // `${nodeId}:${stage}` for current stage lookup
  nodeId: NodeId;
  stage: BuildStage;
  status: BuildTaskStatus;
  startedAt: number;
  completedAt?: number;
  inactiveMs?: number;
  stageId?: string;
}
```

**Dexie Schema:**
```typescript
buildStageStatuses: '&id, nodeId, [nodeId+stage], [nodeId+startedAt]'
```

**Update Frequency:** On stage transitions and stage completion

**Note:** The `id` field uses the format `${nodeId}:${stage}` to enable efficient lookup of the current stage status. Historical records can be queried using `[nodeId+startedAt]` compound index.

### Removed Fields

The following fields are removed from the session record:

**Computed Fields (derivable from other sources):**
- `progress` - Computed from `buildTasks` table aggregation
- `stages` - Computed from `buildTasks` table aggregation by stage

**Unused/Unimplemented Fields:**
- `expiresAt` - Never implemented
- `canResume` - Never implemented
- `resourceUsage` - Never implemented
- `lastActivity` - Redundant with `lastHeartbeatAt`
- `updatedAt` - Redundant with status-specific timestamps
- `elapsedMs` - Computed from `startedAt` and current time
- `elapsedByStage` - Computed from `BuildStageStatus` records
- `stageHeartbeatAt` - Redundant with `BuildSessionHeartbeat.lastHeartbeatAt`

**Moved to Other Tables:**
- `stage` - Moved to `BuildStageStatus` (current stage is the latest record)
- `stageInactiveMs` - Moved to `BuildStageStatus.inactiveMs`
- `stageStartedAt` - Moved to `BuildStageStatus.startedAt`
- `stageId` - Moved to `BuildStageStatus.stageId`

### Migration Strategy

#### EphemeralDB (No Migration Required)

EphemeralDB is volatile and cleared on every startup. The new schema takes effect immediately on next startup with no migration logic required.

**Implementation:**
1. Update `EPHEMERAL_DB_SCHEMA` to version 3 with new tables
2. Remove old `sessions` table
3. Add new tables: `buildSessions`, `buildSessionHeartbeats`, `buildSessionStatuses`, `buildStageStatuses`

```typescript
export const EPHEMERAL_DB_SCHEMA_V3: Record<string, string> = {
  buildSessions: '&nodeId',
  buildSessionHeartbeats: '&nodeId',
  buildSessionStatuses: '&nodeId, status',
  buildStageStatuses: '&id, nodeId, [nodeId+stage], [nodeId+startedAt]',
  buildTasks: '&taskId, nodeId, status, index, stagePriority, sequence'
    + ', [nodeId+status], [nodeId+stage]'
    + ', [nodeId+index], [nodeId+status+index], [nodeId+stage+index], [nodeId+stage+status+index]',
  sourceCache: '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  sourceCacheMeta: '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  geometryCache: '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  geometryCacheMeta: '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  geometryErrors: '&id, nodeId',
  tileEmitBufferRelations: '&id, nodeId, bufferId, [nodeId+bandIndex], [nodeId+bandIndex+tileId]',
};
```

#### ShapeDB (Migration Required)

ShapeDB is persistent and requires migration logic to transform existing `BuildSessionRecord` data.

**Migration Steps:**
1. Bump ShapeDB version to 2
2. Create migration function to transform existing records
3. Split old `BuildSessionRecord` into four new tables
4. Preserve data where possible, discard computed/unused fields

**Migration Logic:**
```typescript
// In ShapeDB constructor
this.version(2).stores({
  buildSessions: '&nodeId',
  buildSessionHeartbeats: '&nodeId',
  buildSessionStatuses: '&nodeId, status',
  buildStageStatuses: '&id, nodeId, [nodeId+stage], [nodeId+startedAt]',
  // ... other tables
}).upgrade(async (tx) => {
  // Migration logic here
  const oldSessions = await tx.table('sessions').toArray();
  
  for (const old of oldSessions) {
    // Create BuildSessionRecord
    await tx.table('buildSessions').add({
      nodeId: old.nodeId,
      domainType: old.domainType,
      selectedArrayByCountries: old.selectedArrayByCountries,
      startedAt: old.startedAt,
      sourceStageMaxima: old.sourceStageMaxima,
    });
    
    // Create BuildSessionHeartbeat
    if (old.lastHeartbeatAt) {
      await tx.table('buildSessionHeartbeats').add({
        nodeId: old.nodeId,
        lastHeartbeatAt: old.lastHeartbeatAt,
      });
    }
    
    // Create BuildSessionStatus
    await tx.table('buildSessionStatuses').add({
      nodeId: old.nodeId,
      status: old.status,
      stopReason: old.stopReason,
      completedAt: old.completedAt,
    });
    
    // Create BuildStageStatus (current stage only, historical data lost)
    if (old.stage) {
      await tx.table('buildStageStatuses').add({
        id: `${old.nodeId}:${old.stage}`,
        nodeId: old.nodeId,
        stage: old.stage,
        status: 'running', // Infer from session status
        startedAt: old.stageStartedAt ?? old.startedAt,
        inactiveMs: old.stageInactiveMs,
        stageId: old.stageId,
      });
    }
  }
});
```

**Note:** Historical stage data cannot be recovered during migration since the old schema only stored the current stage. After migration, new sessions will preserve full stage history.

### API Changes

#### Worker-Side Session Updates

**Current API (ShapeMutationService):**
```typescript
const toBuildSessionRecord = (session: ShapeBuildSessionRecord): EphemeralBuildSessionRecord => {
  return {
    nodeId: session.nodeId,
    status: session.status,
    progress: session.progress,
    stages: session.stages,
    // ... all fields
  };
};
```

**New API:**
```typescript
const toBuildSessionRecords = (session: ShapeBuildSessionRecord): {
  config: BuildSessionRecord;
  heartbeat?: BuildSessionHeartbeat;
  status: BuildSessionStatus;
  stageStatus?: BuildStageStatus;
} => {
  return {
    config: {
      nodeId: session.nodeId,
      domainType: session.domainType,
      selectedArrayByCountries: session.selectedArrayByCountries,
      startedAt: session.startedAt,
      sourceStageMaxima: session.sourceStageMaxima,
    },
    heartbeat: session.lastHeartbeatAt ? {
      nodeId: session.nodeId,
      lastHeartbeatAt: session.lastHeartbeatAt,
    } : undefined,
    status: {
      nodeId: session.nodeId,
      status: session.status,
      stopReason: session.stopReason,
      completedAt: session.completedAt,
    },
    stageStatus: session.stage ? {
      id: `${session.nodeId}:${session.stage}`,
      nodeId: session.nodeId,
      stage: session.stage,
      status: 'running',
      startedAt: session.stageStartedAt ?? session.startedAt,
      inactiveMs: session.stageInactiveMs,
      stageId: session.stageId,
    } : undefined,
  };
};
```

**Update Operations:**
- **Heartbeat Update**: Only update `buildSessionHeartbeats` table
- **Status Update**: Only update `buildSessionStatuses` table
- **Stage Transition**: Create new `buildStageStatuses` record, update previous stage's `completedAt`
- **Session Creation**: Insert into all four tables

#### UI-Side Session Queries

**Current API (ShapeQueryService):**
```typescript
const session = await ephemeralDB.sessions.get(nodeId);
// session contains all fields including progress, stages
```

**New API (Unified Query Interface):**
```typescript
const getSessionWithDetails = async (nodeId: NodeId): Promise<EphemeralBuildSessionRecord | null> => {
  const [config, heartbeat, status, stageStatuses, tasks] = await Promise.all([
    ephemeralDB.buildSessions.get(nodeId),
    ephemeralDB.buildSessionHeartbeats.get(nodeId),
    ephemeralDB.buildSessionStatuses.get(nodeId),
    ephemeralDB.buildStageStatuses.where('nodeId').equals(nodeId).toArray(),
    ephemeralDB.buildTasks.where('nodeId').equals(nodeId).toArray(),
  ]);
  
  if (!config || !status) return null;
  
  // Compute progress from tasks
  const progress = computeProgressFromTasks(tasks);
  
  // Compute stages from tasks
  const stages = computeStagesFromTasks(tasks);
  
  // Get current stage (latest by startedAt)
  const currentStage = stageStatuses.sort((a, b) => b.startedAt - a.startedAt)[0];
  
  return {
    nodeId: config.nodeId,
    domainType: config.domainType,
    status: status.status,
    stopReason: status.stopReason,
    stage: currentStage?.stage,
    progress,
    stages,
    selectedArrayByCountries: config.selectedArrayByCountries,
    startedAt: config.startedAt,
    completedAt: status.completedAt,
    lastHeartbeatAt: heartbeat?.lastHeartbeatAt,
    stageStartedAt: currentStage?.startedAt,
    stageInactiveMs: currentStage?.inactiveMs,
    stageId: currentStage?.stageId,
    sourceStageMaxima: config.sourceStageMaxima,
  };
};
```

**Helper Functions:**
```typescript
const computeProgressFromTasks = (tasks: EphemeralBuildTaskRecord[]): ProgressInfo => {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const skipped = 0; // Computed from task metadata if needed
  
  return {
    total,
    completed,
    failed,
    skipped,
    percentage: total > 0 ? (completed / total) * 100 : 0,
  };
};

const computeStagesFromTasks = (tasks: EphemeralBuildTaskRecord[]): Record<BuildStage, EphemeralStageStatus> => {
  const stages: Record<BuildStage, EphemeralStageStatus> = {
    source: { status: 'queued', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
    geometry: { status: 'queued', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
    tileEmit: { status: 'queued', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
  };
  
  for (const task of tasks) {
    const stage = stages[task.stage];
    stage.tasksTotal++;
    if (task.status === 'completed') stage.tasksCompleted++;
    if (task.status === 'failed') stage.tasksFailed++;
    if (task.status === 'running') stage.status = 'running';
  }
  
  for (const stage of Object.values(stages)) {
    stage.progress = stage.tasksTotal > 0 ? (stage.tasksCompleted / stage.tasksTotal) * 100 : 0;
  }
  
  return stages;
};
```

### Backward Compatibility

#### Transition Period

During the transition period, both old and new APIs will coexist:

1. **Phase 1: Add New Tables** (Week 1)
   - Add new tables to EphemeralDB and ShapeDB
   - Keep old `sessions` table for backward compatibility
   - Write to both old and new tables

2. **Phase 2: Migrate Readers** (Week 2)
   - Update all read operations to use new unified query interface
   - Verify UI components display correct information
   - Keep writing to both old and new tables

3. **Phase 3: Migrate Writers** (Week 3)
   - Update all write operations to use new table structure
   - Stop writing to old `sessions` table
   - Keep old table for rollback capability

4. **Phase 4: Remove Old Table** (Week 4)
   - Remove old `sessions` table from schema
   - Remove backward compatibility code
   - Update documentation

#### Rollback Plan

If issues are discovered during migration:

1. **Immediate Rollback**: Revert to writing to old `sessions` table
2. **Data Recovery**: Old table is preserved during Phases 1-3
3. **Gradual Rollback**: Can roll back individual components (readers/writers) independently

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, verify the new schema works correctly in isolation, then verify the migration preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Verify that the new schema eliminates redundancy and improves update efficiency BEFORE migrating production code.

**Test Plan**: Create test sessions using the new schema and measure serialization overhead, verify stage history preservation, and confirm computed fields match stored fields in the old schema.

**Test Cases**:
1. **Heartbeat Update Performance**: Create a session, perform 100 heartbeat updates, measure serialization time (should be <1ms per update vs ~5ms with old schema)
2. **Stage History Preservation**: Create a session, transition through all three stages, verify all stage records are preserved with correct timestamps
3. **Computed Field Accuracy**: Create a session with tasks, verify computed `progress` and `stages` match the values that would be stored in old schema
4. **Unused Field Removal**: Verify new schema does not contain `expiresAt`, `canResume`, `resourceUsage`, etc.

**Expected Counterexamples**:
- Old schema: Heartbeat updates serialize 2KB+ record
- New schema: Heartbeat updates serialize 16-byte record (nodeId + timestamp)
- Old schema: Stage transitions lose historical data
- New schema: Stage transitions create new records preserving history

### Fix Checking

**Goal**: Verify that for all session operations, the new schema provides the same information as the old schema through the unified query interface.

**Pseudocode:**
```
FOR ALL sessionOperation WHERE isBugCondition(sessionOperation) DO
  oldResult := performOperationOldSchema(sessionOperation)
  newResult := performOperationNewSchema(sessionOperation)
  ASSERT oldResult.visibleFields == newResult.visibleFields
  ASSERT newResult.serializationSize < oldResult.serializationSize
  ASSERT newResult.preservesStageHistory == true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all existing query patterns, the unified query interface returns the same data structure as the old schema.

**Pseudocode:**
```
FOR ALL queryPattern WHERE NOT isBugCondition(queryPattern) DO
  ASSERT queryWithOldSchema(queryPattern) == queryWithNewSchema(queryPattern)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across different session states
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all query patterns

**Test Plan**: Create sessions in various states (idle, running, paused, completed, failed) with different stage configurations, query using both old and new APIs, verify results match.

**Test Cases**:
1. **Session Status Query**: Verify `getSessionWithDetails()` returns same fields as old `sessions.get()`
2. **Progress Calculation**: Verify computed progress matches stored progress in old schema
3. **Stage Information**: Verify current stage information matches old schema
4. **Cleanup Operations**: Verify deleting a session removes all four table records atomically

### Unit Tests

- Test each new table's CRUD operations independently
- Test unified query interface with various session states
- Test migration logic for ShapeDB (old records → new tables)
- Test helper functions (`computeProgressFromTasks`, `computeStagesFromTasks`)

### Property-Based Tests

- Generate random session states and verify unified query returns consistent data
- Generate random task configurations and verify computed progress/stages match aggregations
- Test that all query patterns return same results with old and new schemas

### Integration Tests

- Test full session lifecycle (create → heartbeat → stage transitions → complete)
- Test concurrent updates to different tables (heartbeat + status + stage)
- Test session cleanup removes all related records atomically
- Test UI components display correct information with new schema
