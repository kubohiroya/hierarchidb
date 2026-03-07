# Implementation Plan: Build Session State Synchronization Redesign

## Overview

This implementation redesigns the build session state synchronization architecture to eliminate timeout-based state transitions and ensure reliable event delivery between Worker and UI, while preserving the existing 4-table normalized model and 4-notification system framework.

The solution maintains the current architecture:
- **4-Table Normalized Model**: `buildSessionConfigs`, `buildSessionHeartbeats`, `buildSessionStatuses`, `buildStageStatuses`
- **4-Notification System**: session-state, stage-snapshot, task-progress, heartbeat
- **State Tree Event Processing**: Existing state machine and event handling framework

Key improvements within existing framework:
- Remove timeout-based state progression while keeping state tree structure
- Implement unconditional event emission within existing 4-notification channels
- Add per-notification-type buffering with shared sequence numbering (seqNum)
- Synchronize pub/sub channel establishment within existing event processing
- Eliminate `receiving-task-snapshot` phase while preserving state tree transitions
- Ensure event ordering and gap detection using monotonic sequence numbers

## Requirements

### 1. Immediate Worker Termination (Force Termination)
- 1.1 AbortController must terminate worker processing within 500ms of pause signal
- 1.2 All running tasks must be immediately interrupted without cooperative waiting
- 1.3 Termination timeout must not exceed 500ms under normal conditions
- 1.4 Task state must be preserved during force termination for resume capability

### 2. Terminal State Cache Preservation
- 2.1 Tasks with status `Completed` must retain cache entries after termination
- 2.2 Tasks with status `Skipped` must retain cache entries after termination  
- 2.3 Tasks with status `Failed` must retain cache entries after termination
- 2.4 Terminal task cache entries must remain idempotent across pause/resume cycles

### 3. Lock-Free Cache Write Operations
- 3.1 Cache data writes must use timestamp-based validation (timestamp: 0 = invalid)
- 3.2 Cache metadata writes must occur after data writes without Dexie transactions
- 3.3 Cache entries must be validated by metadata existence, not data existence
- 3.4 Invalid cache entries must be detectable by timestamp: 0 condition
- 3.5 Cache write operations must not use Dexie transaction coordination

### 4. Session Start Cache Cleanup
- 4.1 Invalid cache entries must be deleted before task processing begins
- 4.2 Cleanup must target entries where timestamp === 0 for the specific nodeId
- 4.3 Cleanup failures must cause session start to fail with appropriate error
- 4.4 Cleanup results must be logged with entry counts for debugging

### 5. Non-Terminal Task Reprocessing
- 5.1 Tasks with status `Running` must be identified when pause occurs
- 5.2 Tasks with status `Queued` must be identified when pause occurs
- 5.3 Identified non-terminal tasks must be marked for reprocessing
- 5.4 Marked tasks must be added back to processing queue on resume

### 6. Cache Write Validation
- 6.1 Cache writes must only occur for tasks with terminal status
- 6.2 Cache writes must be prevented for tasks with non-terminal status
- 6.3 Geometry cache writes must follow two-phase pattern (data, then metadata)
- 6.4 Source cache writes must follow two-phase pattern (data, then metadata)

### 7. No Intermediate Data Persistence
- 7.1 Running tasks must not persist intermediate cache data
- 7.2 Queued tasks must not have any cache data present
- 7.3 Cache data existence must correlate with terminal task status
- 7.4 Non-terminal tasks must not have valid cache entries

### 8. Resume Behavior Verification
- 8.1 Resume must continue from exact point where pause occurred
- 8.2 Pause/resume cycles must produce identical results to uninterrupted execution
- 8.3 Multiple pause/resume cycles must maintain state consistency
- 8.4 Progress reporting must remain accurate across pause/resume boundaries

### 9. Redesigned State Synchronization Architecture
- 9.1 Worker must emit events unconditionally regardless of UI state
- 9.2 Event delivery must not depend on UI readiness or subscription timing
- 9.3 Worker-side event buffering must handle UI unavailability gracefully
- 9.4 Session-state, stage-snapshot, task-progress events must have dedicated buffering (heartbeat excluded)
- 9.5 All events except heartbeat must include monotonic sequence number (seqNum) for ordering
- 9.6 UI must buffer session-state, stage-snapshot, task-progress events with seqNum-based ordering
- 9.7 Heartbeat events must be processed immediately without buffering (latest value only)
- 9.8 Buffered events must be applied in seqNum order when UI transitions to ready state
- 9.9 Event gaps must be detectable and recoverable using seqNum for buffered event types
- 9.10 State transitions must not wait for event delivery confirmation
- 9.11 `receiving-task-snapshot` phase must be eliminated entirely
- 9.12 Timeout-based state progression must be removed completely
- 9.13 Pub/sub channels must be established synchronously with component mount
- 9.14 Event channels must be ready before first UI state update
- 9.15 Channel establishment must be part of component lifecycle management
- 9.16 Event delivery must be verifiable end-to-end from Worker to UI
- 9.17 Event sequences must maintain ordering and completeness per buffered notification type
- 9.18 Integration tests must verify multi-stage sessions with pause/resume

## Tasks

- [x] 1. Add cache table schema changes for timestamp-based validation
  - Add `timestamp` field to `geometryCache` and `sourceCache` tables in Dexie schema
  - Update cache table type definitions to include `timestamp: number` field
  - Create migration script to add timestamp field with default value 0 for existing entries
  - _Requirements: 3.1, 3.2, 6.3, 6.4_

- [x] 2. Implement lock-free cache write flow
  - [x] 2.1 Refactor geometry cache write to use two-phase write (data with timestamp:0, then metadata)
    - Update `writeGeometryCache` to write data with `timestamp: 0` first
    - Write `geometryCacheMeta` with `Date.now()` timestamp after data write completes
    - Remove any Dexie transaction blocks coordinating data and metadata writes
    - _Requirements: 3.1, 3.2, 3.5, 6.3_

  - [x] 2.2 Write property test for cache write ordering
    - **Property 6: Cache Write Ordering**
    - **Validates: Requirements 3.1, 3.2, 6.3, 6.4**

  - [x] 2.3 Refactor source cache write to use two-phase write (data with timestamp:0, then metadata)
    - Update `writeSourceCache` to write data with `timestamp: 0` first
    - Write `sourceCacheMeta` with `Date.now()` timestamp after data write completes
    - Remove any Dexie transaction blocks coordinating data and metadata writes
    - _Requirements: 3.1, 3.2, 3.5, 6.4_

  - [x] 2.4 Write property test for cache type consistency
    - **Property 11: Cache Type Consistency**
    - **Validates: Requirements 6.1, 6.2**

- [x] 3. Implement cache validation and cleanup logic
  - [x] 3.1 Create `CacheValidator` service with invalid entry detection
    - Implement `cleanupInvalidEntries(nodeId)` to query cache entries where `timestamp === 0`
    - Delete invalid geometry cache entries and return count
    - Delete invalid source cache entries and return count
    - Log cleanup results with counts
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 3.2 Write property test for cache entry validation
    - **Property 7: Cache Entry Validation**
    - **Validates: Requirements 3.3, 3.4**

  - [x] 3.3 Write property test for invalid cache cleanup
    - **Property 8: Invalid Cache Cleanup**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [x] 3.4 Implement `isValidEntry` method for runtime validation
    - Check if both cache data and cache metadata exist
    - Return true only if metadata exists (data with timestamp:0 is invalid)
    - _Requirements: 3.3, 3.4_

- [x] 4. Checkpoint - Ensure cache validation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add AbortController to session management
  - [x] 5.1 Add AbortController to session state
    - Add `abortController?: AbortController` field to session state interface
    - Create new AbortController when session starts
    - Store AbortController reference in session state
    - _Requirements: 1.1, 1.2_

  - [x] 5.2 Implement immediate abort on pause
    - Update `pause()` method to call `abortController.abort()` immediately after `setPaused(true)`
    - Add timing measurement to verify termination completes within 500ms
    - Log warning if termination takes longer than 500ms
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 5.3 Write property test for immediate worker termination
    - **Property 1: Immediate Worker Termination**
    - **Validates: Requirements 1.1, 1.2**

  - [x] 5.4 Write property test for termination time bound
    - **Property 2: Termination Time Bound**
    - **Validates: Requirements 1.3**

  - [x] 5.5 Pass AbortSignal to stage orchestrators
    - Update `runShapeSourceStageSection` to accept and pass `abortSignal` parameter
    - Update `runShapeGeometryStageSection` to accept and pass `abortSignal` parameter
    - Update `runShapeTileEmitStageSection` to accept and pass `abortSignal` parameter
    - Pass `abortController.signal` from session to all stage functions
    - _Requirements: 1.1, 1.2_

  - [x] 5.6 Update vectortile-orchestrator to handle AbortSignal
    - Add `abortSignal?: AbortSignal` parameter to `runVectorTileStageOrchestrator`
    - Check `abortSignal.aborted` before processing each task
    - Throw abort error if signal is aborted during task processing
    - _Requirements: 1.1, 1.2_

- [x] 5.7 worker.terminate() フォールバック実装
  - [x] Issue #702 を起票
  - [x] StageProcessingService で worker インスタンスへのアクセス手段を追加
  - [x] pause ハンドラで 1000ms タイムアウト後に worker.terminate() を呼び出す仕組みを実装
  - [x] 強制終了時の適切なログ出力を追加
  - [x] セッション状態の適切なクリーンアップを実装

- [ ] 6. Redesign build session state synchronization architecture
  - [x] 6.1 Implement unconditional Worker-to-UI event streaming
    - Remove all UI state dependency from Worker-side event emission
    - Implement guaranteed task snapshot delivery regardless of UI readiness
    - Add event buffering on Worker side with automatic retry mechanism
    - Ensure nodeId-based event routing works independently of UI subscription state
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 6.2 Implement per-notification-type event buffering with shared sequence numbering
    - Create dedicated buffers for session-state, stage-snapshot, task-progress events (heartbeat excluded)
    - Add monotonic sequence number (seqNum) to session-state, stage-snapshot, task-progress events from Worker side
    - Process heartbeat events immediately without buffering (latest value only)
    - Implement seqNum-based ordering and gap detection in UI buffers for buffered event types
    - Add buffer flush mechanism that applies events in seqNum order per buffered notification type
    - Ensure buffered events are never dropped and gaps are detectable/recoverable
    - _Requirements: 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [x] 6.3 Eliminate synchronous state transition dependencies
    - Remove `receiving-task-snapshot` phase and associated timeout logic
    - Delete `useShapeBuildSessionStartupTransitionTimers.ts` entirely
    - Implement immediate state progression without waiting for event delivery
    - Separate event delivery from state machine progression
    - _Requirements: 9.9, 9.10, 9.11_

  - [x] 6.4 Implement render-synchronized pub/sub initialization
    - Ensure `subscribeBuildTasks` is called synchronously with Stage5 component mount
    - Add pub/sub channel establishment as part of component lifecycle
    - Implement channel readiness verification before any UI state updates
    - Guarantee event channel availability before first render
    - _Requirements: 9.12, 9.13, 9.14_

  - [ ] 6.5 Add comprehensive event delivery verification
    - [x] 6.5.1 Implement end-to-end event delivery testing from Worker to UI
      - Complete integration test suite covering unconditional delivery, loss-free buffering, timeout elimination, and synchronized pub/sub
      - Tests verify events are delivered regardless of UI readiness state
      - Tests confirm buffer integrity during UI state transitions
      - Tests validate immediate state progression without timeout dependencies
      - _Requirements: 9.1, 9.2, 9.3, 9.7, 9.8, 9.9_

  - [x] 6.5.2 Add Worker-to-UI event streaming integration tests
    - Create tests that verify actual Worker process emitting events to UI components
    - Test event delivery across process boundaries (Worker thread to main thread)
    - Verify seqNum generation and distribution in multi-worker scenarios
    - Test AbortController integration with event streaming termination
    - _Requirements: 9.1, 9.2, 9.5, 1.1, 1.2_

    - [ ] 6.5.3 Add multi-stage session with pause/resume integration tests
      - Test complete session lifecycle: start → source stage → geometry stage → tile-emit stage → completion
      - Verify pause/resume cycles maintain event sequence integrity across all stages
      - Test event delivery during stage transitions and worker restarts
      - Validate cache write events are properly sequenced with task completion events
      - _Requirements: 9.16, 9.17, 8.1, 8.2, 8.3_

    - [ ] 6.5.4 Add event ordering and completeness verification across session lifecycle
      - Test event sequence verification across multiple notification types simultaneously
      - Verify no events are lost during rapid emission sequences (stress testing)
      - Test gap detection and recovery mechanisms under various failure scenarios
      - Validate event delivery monitoring and metrics collection accuracy
      - _Requirements: 9.16, 9.17, 9.18_

  - [ ] 6.6 Write property tests for new architecture
    - [x] 6.6.1 **Property 18: Unconditional Event Delivery**
      - Validates events are emitted regardless of subscriber presence
      - Validates events are delivered to all current subscribers
      - _Validates: Requirements 9.1, 9.2_

    - [x] 6.6.2 **Property 19: Loss-Free Event Buffering**
      - Validates all events are buffered without loss
      - Validates seqNum ordering within notification types
      - Validates gap detection in sequence numbers
      - _Validates: Requirements 9.4, 9.5, 9.6, 9.8, 9.9_

    - [x] 6.6.3 **Property 20: State Transition Independence**
      - Validates events are processed independently of state machine progression
      - Validates concurrent event processing without blocking
      - _Validates: Requirements 9.10, 9.11_

    - [x] 6.6.4 **Property 21: Render-Synchronized Channel Establishment**
      - Validates channels are established synchronously without race conditions
      - Validates heartbeat events are processed without buffering
      - _Validates: Requirements 9.12, 9.13, 9.14, 9.7_

    - [ ] 6.6.5 **Property 22: Distributed Sequence Number Generation**
      - Validates seqNum generation is monotonic within each notification type per node
      - Validates parallel worker seqNum distribution prevents collisions
      - Validates seqNum reset and cleanup behavior on session restart
      - _Validates: Requirements 9.5, 9.16_

    - [ ] 6.6.6 **Property 23: Event Delivery Monitoring Accuracy**
      - Validates delivery metrics accurately track emission, buffering, and processing
      - Validates latency measurements are within expected bounds
      - Validates buffer utilization metrics reflect actual buffer states
      - _Validates: Requirements 9.18_

- [ ] 7. Checkpoint - Ensure redesigned architecture tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement no intermediate data persistence verification
  - [x] 8.1 Add runtime checks to prevent intermediate persistence
    - Add assertion that cache writes only occur when task status is terminal
    - Verify no cache data exists for tasks in `Running` status
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 8.2 Write property test for no intermediate persistence
    - **Property 12: No Intermediate Persistence**
    - **Validates: Requirements 7.1, 7.2**

  - [x] 8.3 Write property test for running task cache invariant
    - **Property 13: Running Task Cache Invariant**
    - **Validates: Requirements 7.3, 7.4**

- [x] 9. Integrate cleanup into session start flow
  - [x] 9.1 Add cleanup call at session start
    - Call `cleanupInvalidEntries(nodeId)` before processing any tasks
    - Wait for cleanup to complete before starting task processing
    - Handle cleanup failures by failing session start
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 9.2 Update session start error handling
    - Catch cleanup errors and throw session start failure
    - Log cleanup errors with context
    - _Requirements: 4.3_

- [x] 10. Implement resume behavior verification
  - [x] 10.1 Write property test for resume continuation
    - **Property 14: Resume Continuation**
    - **Validates: Requirements 8.1**

  - [x] 10.2 Write property test for pause/resume equivalence
    - **Property 15: Pause/Resume Equivalence**
    - **Validates: Requirements 8.2**

  - [x] 10.3 Write property test for multi-cycle state consistency
    - **Property 16: Multi-Cycle State Consistency**
    - **Validates: Requirements 8.3**

  - [x] 10.4 Write property test for progress reporting accuracy
    - **Property 17: Progress Reporting Accuracy**
    - **Validates: Requirements 8.4**

- [ ] 11. Add integration tests for redesigned architecture
  - [ ] 11.1 Write integration test for unconditional event delivery
    - Start a build session and verify all events are delivered regardless of UI state
    - Test event delivery during UI component mount/unmount cycles
    - Verify Worker continues emitting events even when UI is not ready
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 11.2 Write integration test for loss-free event buffering
    - Generate rapid event sequences and verify no events are lost
    - Test buffer behavior during UI state transitions
    - Verify buffered events are applied in correct order when UI becomes ready
    - _Requirements: 9.4, 9.5, 9.6_

  - [ ] 11.3 Write integration test for timeout elimination
    - Start multiple build sessions and verify no timeout-based state transitions
    - Confirm `receiving-task-snapshot` phase is completely eliminated
    - Verify state progression is immediate and not dependent on event delivery
    - _Requirements: 9.7, 9.8, 9.9_

  - [ ] 11.4 Write integration test for synchronized pub/sub initialization
    - Test component mount with immediate pub/sub channel establishment
    - Verify channels are ready before first UI state update
    - Test channel establishment across multiple component lifecycle events
    - _Requirements: 9.10, 9.11, 9.12_

- [ ] 12. Update error handling and logging
  - [ ] 12.1 Add abort signal error handling in task processors
    - Catch abort errors in task processing functions
    - Log abort events with task context
    - Ensure abort errors don't propagate as failures
    - _Requirements: 1.1, 1.2_

  - [ ] 12.2 Add cache write failure handling
    - Ensure metadata write failure leaves entry invalid (timestamp:0)
    - Log cache write failures with context
    - _Requirements: 3.1, 3.2_

  - [ ] 12.3 Add event delivery monitoring and logging
    - Log all event emissions from Worker side with timestamps
    - Log all event receptions on UI side with processing status
    - Add metrics for event delivery latency and buffer utilization
    - _Requirements: 9.13, 9.14, 9.15_

- [ ] 13. Final checkpoint - Ensure all tests pass
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
- **NEW**: Unconditional event streaming eliminates UI state dependencies
- **NEW**: Universal event buffering prevents event loss during UI transitions
- **NEW**: Timeout elimination removes unreliable state progression mechanisms
- **NEW**: Synchronized pub/sub initialization guarantees channel availability
