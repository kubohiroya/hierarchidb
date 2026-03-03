# Implementation Plan: Shape Build Force Terminate on Pause

## Overview

This implementation introduces immediate termination of shape build sessions on pause, replacing the current cooperative suspension mechanism. The solution uses AbortController for immediate worker termination, metadata-based cache validation without Dexie transactions, and automatic cleanup of invalid cache entries on session start.

Key technical changes:
- Add AbortController to session management for immediate termination
- Refactor cache write flow to use lock-free metadata-based validation (timestamp: 0 = invalid)
- Implement session start cleanup to remove invalid cache entries
- Update task state management to handle pause/resume correctly
- Add comprehensive property-based testing with fast-check (100+ iterations per property)

## Tasks

- [-] 1. Add cache table schema changes for timestamp-based validation
  - Add `timestamp` field to `geometryCache` and `sourceCache` tables in Dexie schema
  - Update cache table type definitions to include `timestamp: number` field
  - Create migration script to add timestamp field with default value 0 for existing entries
  - _Requirements: 3.1, 3.2, 6.3, 6.4_

- [ ] 2. Implement lock-free cache write flow
  - [~] 2.1 Refactor geometry cache write to use two-phase write (data with timestamp:0, then metadata)
    - Update `writeGeometryCache` to write data with `timestamp: 0` first
    - Write `geometryCacheMeta` with `Date.now()` timestamp after data write completes
    - Remove any Dexie transaction blocks coordinating data and metadata writes
    - _Requirements: 3.1, 3.2, 3.5, 6.3_

  - [~] 2.2 Write property test for cache write ordering
    - **Property 6: Cache Write Ordering**
    - **Validates: Requirements 3.1, 3.2, 6.3, 6.4**

  - [~] 2.3 Refactor source cache write to use two-phase write (data with timestamp:0, then metadata)
    - Update `writeSourceCache` to write data with `timestamp: 0` first
    - Write `sourceCacheMeta` with `Date.now()` timestamp after data write completes
    - Remove any Dexie transaction blocks coordinating data and metadata writes
    - _Requirements: 3.1, 3.2, 3.5, 6.4_

  - [~] 2.4 Write property test for cache type consistency
    - **Property 11: Cache Type Consistency**
    - **Validates: Requirements 6.1, 6.2**

- [ ] 3. Implement cache validation and cleanup logic
  - [~] 3.1 Create `CacheValidator` service with invalid entry detection
    - Implement `cleanupInvalidEntries(nodeId)` to query cache entries where `timestamp === 0`
    - Delete invalid geometry cache entries and return count
    - Delete invalid source cache entries and return count
    - Log cleanup results with counts
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [~] 3.2 Write property test for cache entry validation
    - **Property 7: Cache Entry Validation**
    - **Validates: Requirements 3.3, 3.4**

  - [~] 3.3 Write property test for invalid cache cleanup
    - **Property 8: Invalid Cache Cleanup**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [~] 3.4 Implement `isValidEntry` method for runtime validation
    - Check if both cache data and cache metadata exist
    - Return true only if metadata exists (data with timestamp:0 is invalid)
    - _Requirements: 3.3, 3.4_

- [~] 4. Checkpoint - Ensure cache validation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Add AbortController to session management
  - [~] 5.1 Add AbortController to session state
    - Add `abortController?: AbortController` field to session state interface
    - Create new AbortController when session starts
    - Store AbortController reference in session state
    - _Requirements: 1.1, 1.2_

  - [~] 5.2 Implement immediate abort on pause
    - Update `pause()` method to call `abortController.abort()` immediately after `setPaused(true)`
    - Add timing measurement to verify termination completes within 500ms
    - Log warning if termination takes longer than 500ms
    - _Requirements: 1.1, 1.2, 1.3_

  - [~] 5.3 Write property test for immediate worker termination
    - **Property 1: Immediate Worker Termination**
    - **Validates: Requirements 1.1, 1.2**

  - [~] 5.4 Write property test for termination time bound
    - **Property 2: Termination Time Bound**
    - **Validates: Requirements 1.3**

  - [~] 5.5 Pass AbortSignal to stage orchestrators
    - Update `runShapeSourceStageSection` to accept and pass `abortSignal` parameter
    - Update `runShapeGeometryStageSection` to accept and pass `abortSignal` parameter
    - Update `runShapeTileEmitStageSection` to accept and pass `abortSignal` parameter
    - Pass `abortController.signal` from session to all stage functions
    - _Requirements: 1.1, 1.2_

  - [~] 5.6 Update vectortile-orchestrator to handle AbortSignal
    - Add `abortSignal?: AbortSignal` parameter to `runVectorTileStageOrchestrator`
    - Check `abortSignal.aborted` before processing each task
    - Throw abort error if signal is aborted during task processing
    - _Requirements: 1.1, 1.2_

- [ ] 6. Update task state management for pause/resume
  - [~] 6.1 Implement task state preservation on termination
    - Ensure all task state (status, input, output, timestamps) is preserved when abort occurs
    - Verify no task state is lost during force termination
    - _Requirements: 1.4_

  - [~] 6.2 Write property test for task state preservation
    - **Property 3: Task State Preservation on Termination**
    - **Validates: Requirements 1.4**

  - [~] 6.3 Implement terminal state cache preservation
    - Verify that tasks with status `Completed`, `Skipped`, or `Failed` retain their cache entries
    - Ensure cache data and metadata are not deleted during force termination
    - _Requirements: 2.1, 2.2, 2.3_

  - [~] 6.4 Write property test for terminal state cache preservation
    - **Property 4: Terminal State Cache Preservation**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [~] 6.5 Write property test for terminal task idempotence
    - **Property 5: Terminal Task Idempotence**
    - **Validates: Requirements 2.4**

  - [~] 6.6 Implement running task identification on pause
    - Query all tasks with status `Running` or `Queued` when pause occurs
    - Mark these tasks as eligible for reprocessing
    - Store list of tasks to reprocess in session state
    - _Requirements: 5.1, 5.2, 5.3_

  - [~] 6.7 Write property test for non-terminal task identification
    - **Property 9: Non-Terminal Task Identification**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [~] 6.8 Implement task reprocessing on resume
    - Query tasks marked for reprocessing when resume is called
    - Add these tasks back to the processing queue
    - Reset task status from `Running` to `Queued` for reprocessing
    - _Requirements: 5.4_

  - [~] 6.9 Write property test for non-terminal task reprocessing
    - **Property 10: Non-Terminal Task Reprocessing**
    - **Validates: Requirements 5.4**

- [~] 7. Checkpoint - Ensure task state management tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement no intermediate data persistence verification
  - [~] 8.1 Add runtime checks to prevent intermediate persistence
    - Add assertion that cache writes only occur when task status is terminal
    - Verify no cache data exists for tasks in `Running` status
    - _Requirements: 7.1, 7.2, 7.3_

  - [~] 8.2 Write property test for no intermediate persistence
    - **Property 12: No Intermediate Persistence**
    - **Validates: Requirements 7.1, 7.2**

  - [~] 8.3 Write property test for running task cache invariant
    - **Property 13: Running Task Cache Invariant**
    - **Validates: Requirements 7.3, 7.4**

- [ ] 9. Integrate cleanup into session start flow
  - [~] 9.1 Add cleanup call at session start
    - Call `cleanupInvalidEntries(nodeId)` before processing any tasks
    - Wait for cleanup to complete before starting task processing
    - Handle cleanup failures by failing session start
    - _Requirements: 4.1, 4.2, 4.3_

  - [~] 9.2 Update session start error handling
    - Catch cleanup errors and throw session start failure
    - Log cleanup errors with context
    - _Requirements: 4.3_

- [ ] 10. Implement resume behavior verification
  - [~] 10.1 Write property test for resume continuation
    - **Property 14: Resume Continuation**
    - **Validates: Requirements 8.1**

  - [~] 10.2 Write property test for pause/resume equivalence
    - **Property 15: Pause/Resume Equivalence**
    - **Validates: Requirements 8.2**

  - [~] 10.3 Write property test for multi-cycle state consistency
    - **Property 16: Multi-Cycle State Consistency**
    - **Validates: Requirements 8.3**

  - [~] 10.4 Write property test for progress reporting accuracy
    - **Property 17: Progress Reporting Accuracy**
    - **Validates: Requirements 8.4**

- [ ] 11. Add integration tests for pause/resume flow
  - [~] 11.1 Write integration test for end-to-end pause/resume
    - Start a build session with multiple tasks
    - Pause during processing and verify termination within 500ms
    - Resume and verify completion with correct final output
    - _Requirements: 1.3, 8.1, 8.2_

  - [~] 11.2 Write integration test for multiple pause/resume cycles
    - Start a build session
    - Pause and resume 3 times during processing
    - Verify final output matches uninterrupted build
    - Verify task state consistency across all cycles
    - _Requirements: 8.2, 8.3_

  - [~] 11.3 Write integration test for cache cleanup on start
    - Create invalid cache entries (data with timestamp:0, no metadata)
    - Start a new session
    - Verify invalid entries are deleted before task processing
    - Verify cleanup count is logged
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [~] 11.4 Write integration test for long-running task termination
    - Start a task that takes 10+ seconds (e.g., complex geometry simplification)
    - Pause immediately after task starts
    - Verify termination completes within 500ms
    - Verify task is marked for reprocessing
    - _Requirements: 1.2, 1.3, 5.3_

- [ ] 12. Update error handling and logging
  - [~] 12.1 Add abort signal error handling in task processors
    - Catch abort errors in task processing functions
    - Log abort events with task context
    - Ensure abort errors don't propagate as failures
    - _Requirements: 1.1, 1.2_

  - [~] 12.2 Add cache write failure handling
    - Ensure metadata write failure leaves entry invalid (timestamp:0)
    - Log cache write failures with context
    - _Requirements: 3.1, 3.2_

  - [~] 12.3 Add termination timeout warning
    - Log warning if termination takes longer than 500ms
    - Include elapsed time and task context in warning
    - _Requirements: 1.3_

- [~] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check with minimum 100 iterations
- Property tests are tagged with feature name and property number
- Checkpoints ensure incremental validation
- AbortController provides immediate termination without cooperative waiting
- Metadata-based validation avoids Dexie transaction lock contention
- Session start cleanup ensures consistent state across pause/resume cycles
