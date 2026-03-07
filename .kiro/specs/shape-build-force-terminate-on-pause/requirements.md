# Requirements Document

## Introduction

This feature addresses UX issues in the shape build session where pause operations wait for long-running tasks (e.g., turf.simplify) to complete cooperatively. The current implementation uses `waitIfPaused()` for cooperative suspension, which is unacceptable when processing complex geometries. This feature introduces immediate termination of parallel stage processing workers on pause, while preserving completed task results and safely handling incomplete data through a metadata-based validation strategy.

## Glossary

- **Build_Session**: The shape build process that executes parallel tasks across multiple stages (source, transform, tile-emit)
- **Parallel_Stage_Worker**: Worker threads executing parallel tasks within a build session stage
- **Task_Status**: The state of a task, one of: `Queued`, `Running`, `Completed`, `Skipped`, `Failed`
- **Cache_Data**: The actual geometry or source data stored in `geometryCache` or `sourceCache` tables
- **Cache_Metadata**: The metadata record stored in `geometryCacheMeta` or `sourceCacheMeta` tables
- **Valid_Cache_Entry**: A cache entry where both Cache_Data and Cache_Metadata exist
- **Invalid_Cache_Entry**: A cache entry where Cache_Data exists but Cache_Metadata is missing
- **Pause_Request**: User action to suspend the build session
- **Resume_Request**: User action to continue a paused build session
- **Force_Termination**: Immediate termination of worker threads without waiting for task completion
- **Cooperative_Suspension**: The current pause mechanism that waits for tasks to complete naturally

## Requirements

### Requirement 1: Immediate Worker Termination on Pause

**User Story:** As a user, I want the build session to stop immediately when I click pause, so that I don't have to wait for long-running geometry processing tasks to complete.

#### Acceptance Criteria

1. WHEN a Pause_Request is received, THE Build_Session SHALL immediately terminate all Parallel_Stage_Workers
2. WHEN a Pause_Request is received, THE Build_Session SHALL NOT wait for running tasks to complete cooperatively
3. THE Build_Session SHALL complete Force_Termination within 500 milliseconds of receiving a Pause_Request
4. WHEN Force_Termination occurs, THE Build_Session SHALL preserve all task state information for resume

### Requirement 2: Completed Task Preservation

**User Story:** As a user, I want my completed work to be saved when I pause, so that I don't lose progress when resuming the build.

#### Acceptance Criteria

1. WHEN Force_Termination occurs, THE Build_Session SHALL preserve all Cache_Data and Cache_Metadata for tasks with status `Completed`
2. WHEN Force_Termination occurs, THE Build_Session SHALL preserve all Cache_Data and Cache_Metadata for tasks with status `Skipped`
3. WHEN Force_Termination occurs, THE Build_Session SHALL preserve all Cache_Data and Cache_Metadata for tasks with status `Failed`
4. WHEN a Resume_Request is received, THE Build_Session SHALL NOT reprocess tasks with status `Completed`, `Skipped`, or `Failed`

### Requirement 3: Metadata-Based Cache Validation Strategy

**User Story:** As a developer, I want a safe way to identify incomplete cache entries without using Dexie transactions, so that we avoid lock contention issues.

#### Acceptance Criteria

1. WHEN storing cache data, THE Build_Session SHALL write Cache_Data with `timestamp: 0` initially
2. WHEN Cache_Data write completes, THE Build_Session SHALL update the same record with a non-zero timestamp
3. THE Build_Session SHALL treat a cache entry as Valid_Cache_Entry only when `timestamp > 0`
4. THE Build_Session SHALL treat a cache entry as Invalid_Cache_Entry when `timestamp === 0`
5. THE Build_Session SHALL NOT use Dexie transaction blocks to coordinate cache writes

### Requirement 4: Invalid Cache Cleanup on Session Start

**User Story:** As a user, I want incomplete data from interrupted sessions to be cleaned up automatically, so that my next build starts with a consistent state.

#### Acceptance Criteria

1. WHEN a Build_Session starts, THE Build_Session SHALL identify all Invalid_Cache_Entry records for the target node
2. WHEN Invalid_Cache_Entry records are identified, THE Build_Session SHALL delete the corresponding Cache_Data records
3. THE Build_Session SHALL complete Invalid_Cache_Entry cleanup before processing any new tasks
4. WHEN cleanup completes, THE Build_Session SHALL log the count of deleted Invalid_Cache_Entry records

### Requirement 5: Running Task State Management

**User Story:** As a developer, I want tasks that were running during Force_Termination to be marked for reprocessing, so that incomplete work is properly handled on resume.

#### Acceptance Criteria

1. WHEN Force_Termination occurs, THE Build_Session SHALL identify all tasks with status `Running`
2. WHEN Force_Termination occurs, THE Build_Session SHALL identify all tasks with status `Queued`
3. WHEN Force_Termination completes, THE Build_Session SHALL mark `Running` and `Queued` tasks as eligible for reprocessing
4. WHEN a Resume_Request is received, THE Build_Session SHALL reprocess all tasks that were `Running` or `Queued` during Force_Termination

### Requirement 6: Cache Table Consistency

**User Story:** As a developer, I want to ensure that geometry and source cache tables follow the same validation rules, so that the system behaves consistently across all cache types.

#### Acceptance Criteria

1. THE Build_Session SHALL apply the metadata-based validation strategy to `geometryCache` and `geometryCacheMeta` tables
2. THE Build_Session SHALL apply the metadata-based validation strategy to `sourceCache` and `sourceCacheMeta` tables
3. WHEN writing to `geometryCache`, THE Build_Session SHALL write `geometryCacheMeta` after data write completes
4. WHEN writing to `sourceCache`, THE Build_Session SHALL write `sourceCacheMeta` after data write completes

### Requirement 7: No Intermediate Data Persistence

**User Story:** As a developer, I want to verify that no intermediate processing data is persisted, so that cleanup logic only needs to handle final task outputs.

#### Acceptance Criteria

1. THE Build_Session SHALL NOT persist partial task results during task execution
2. THE Build_Session SHALL persist task results only when a task transitions to `Completed`, `Skipped`, or `Failed` status
3. WHEN a task is in `Running` status, THE Build_Session SHALL NOT have any associated Cache_Data or Cache_Metadata records
4. WHEN Force_Termination occurs during task execution, THE Build_Session SHALL NOT leave partial Cache_Data records for `Running` tasks

### Requirement 8: Resume Behavior Verification

**User Story:** As a user, I want to verify that pause and resume work correctly, so that I can trust the system to handle interruptions safely.

#### Acceptance Criteria

1. WHEN a Build_Session is paused and resumed, THE Build_Session SHALL continue from the last completed task
2. WHEN a Build_Session is paused and resumed, THE Build_Session SHALL produce the same final output as an uninterrupted session
3. WHEN a Build_Session is paused and resumed multiple times, THE Build_Session SHALL maintain task state consistency across all pause/resume cycles
4. WHEN a Build_Session resumes, THE Build_Session SHALL report accurate progress based on preserved completed tasks
