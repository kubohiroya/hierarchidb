# Bugfix Requirements Document

## Introduction

The current `EphemeralBuildSessionRecord` in EphemeralDB suffers from poor responsibility separation, leading to data duplication, unused fields, and inefficient serialization. Fields like `selectedArrayByCountries`, `progress`, and `stages` are stored redundantly when they can be computed from CoreDB or task queues. Additionally, fields with different update frequencies (1-second heartbeats, state transitions, and immutable data) are mixed in a single record, causing unnecessary serialization overhead. Stage information is also lost as only the current stage is retained.

This bugfix refactors the session record into four distinct tables with clear responsibilities: immutable session configuration, heartbeat tracking, session-level status, and per-stage status tracking.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a build session is created THEN the system stores `selectedArrayByCountries`, `progress`, and `stages` in `EphemeralBuildSessionRecord` even though these can be computed from CoreDB and task queues

1.2 WHEN heartbeat updates occur every 1 second THEN the system serializes and deserializes the entire `EphemeralBuildSessionRecord` including immutable and infrequently-updated fields

1.3 WHEN a build session transitions between stages THEN the system overwrites the `stage` field, losing historical stage information

1.4 WHEN examining the session record THEN the system exposes unused fields (`expiresAt`, `canResume`, `resourceUsage`) that are either unimplemented or derivable from other sources

1.5 WHEN multiple update frequencies coexist (heartbeat, state transition, immutable) THEN the system mixes all responsibilities in a single record, causing inefficient updates

### Expected Behavior (Correct)

2.1 WHEN a build session is created THEN the system SHALL store only immutable configuration data (`nodeId`, `domainType`, `selectedArrayByCountries`, `selectedArrayVersion`, `startedAt`, `sourceStageMaxima`) in `BuildSessionRecord` and compute derived fields on demand

2.2 WHEN heartbeat updates occur every 1 second THEN the system SHALL update only `BuildSessionHeartbeat` table with `nodeId` and `lastHeartbeatAt`, avoiding serialization of other fields

2.3 WHEN a build session transitions between stages THEN the system SHALL create a new `BuildStageStatus` record for each stage (source, geometry, tileEmit), preserving historical stage information

2.4 WHEN examining the session record THEN the system SHALL expose only actively-used fields and remove unused fields (`expiresAt`, `canResume`, `resourceUsage`)

2.5 WHEN multiple update frequencies coexist THEN the system SHALL separate responsibilities into four distinct tables: `BuildSessionRecord` (immutable), `BuildSessionHeartbeat` (1-second updates), `BuildSessionStatus` (state transitions), and `BuildStageStatus` (per-stage tracking)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN querying the current session status THEN the system SHALL CONTINUE TO provide the same information through a unified query interface

3.2 WHEN the UI displays build progress THEN the system SHALL CONTINUE TO show progress information computed from task queues

3.3 WHEN a session is resumed or cancelled THEN the system SHALL CONTINUE TO support these operations with the same external API

3.4 WHEN existing code queries `ephemeralDB.sessions` THEN the system SHALL CONTINUE TO provide backward-compatible access patterns during migration

3.5 WHEN session cleanup occurs THEN the system SHALL CONTINUE TO remove all related records (session, heartbeat, status, and stage records) atomically
