# YAML storage single canonical activation

This ExecPlan is a living implementation plan for [GitHub Issue #1340](https://github.com/kubohiroya/hierarchidb/issues/1340). The separately approved corrective recovery amendment is tracked by [GitHub Issue #1388](https://github.com/kubohiroya/hierarchidb/issues/1388). GitHub Issues and the repository Project remain the status SSOT. This document records implementation reasoning and concrete repository operations; it is not a second task ledger.

## Purpose and user-visible outcome

The release replaces the production legacy YAML storage graph with one canonical CoreDB-backed graph. On the first activation-capable load, exactly one origin context quiesces all compatible legacy contexts, validates the complete raw CoreDB logical v1 / native v10 YAML cohort, upgrades CoreDB to logical v2 / native v20 atomically, initializes the database, and performs a success-only reload handoff. The new runtime and every later runtime publish YAML APIs only after exact CoreDB logical v2 / native v20 schema validation, canonical-only raw YAML validation, and current WorkerService initialization succeed.

After completion, YAML filenames live only in the matching metadata slot and YAML payloads have the exact shape `{ subtype, schemaId, content }`. Dialog save/save-draft, generic Worker CRUD, folder ZIP import/export, and SimulationWorkflow all use CoreDB. Production code cannot reach a YamlDB writer, the legacy folder ZIP serializer, or the legacy Simulation serializer. Activation failures remain visible and fail closed; they do not offer a generic IndexedDB reset, retry the upgrade, reopen logical v1 / native v10, or fall back to legacy storage.

## Progress

- [x] 2026-08-21: Confirmed #1338 accepted evidence, CoreDB logical v1 / native v10, clean main, and byte-unchanged fixed coordinator graph.
- [x] 2026-08-21: Updated #1340 dependency, DoD, rollback, and Project status after user approval.
- [x] 2026-08-21: Added the single-executor and post-activation bootstrap contract to the canonical specifications.
- [x] 2026-08-21: Implemented and tested strict post-activation canonical-ready state creation.
- [x] 2026-08-21: Implemented raw CoreDB inspection, logical v1 / native v10 preflight, logical v2 / native v20 versionchange migration, journal writes, and distinct fresh-v2 creation.
- [x] 2026-08-21: Connected the activation-aware window bootstrap and success-only reload handoff.
- [x] 2026-08-21: Gated production Worker publication and all exposed Worker APIs on current canonical-ready evidence.
- [x] 2026-08-21: Connected canonical dialog, generic CRUD validation, ZIP, and Simulation routes.
- [x] 2026-08-21: Removed legacy YamlDB writer exports, folder ZIP helpers, Simulation serializer/subpath, and YAML plugin preload reachability.
- [x] 2026-08-21: Updated the English and Japanese package READMEs.
- [x] 2026-08-21: Integrated current `main` through `de6713d15` without conflicts and reran the scoped install, registry, typecheck, test, build, and lint matrix successfully.
- [x] 2026-08-21: Verified the fixed coordinator source graph has zero diff from `f297cdc70a4e1665e1d26d4d931563af1e05bcd9` and the built coordinator SHA-256 remains `674f8172afabfec3b13cf91a3491d8baa99a2b64c6f2d626952766b11b2ad9d4`.
- [x] 2026-08-21: Passed strict dependency fence and the repository dependency guard; the latter retained 13 baseline warnings and returned exit 0.
- [x] 2026-08-21: Ran the CI-style naming baseline comparison: base 3 errors to head 3 errors, with zero new naming errors.
- [ ] Reconcile #1340's raw `pnpm format` and raw naming commands with the repository baseline before claiming every recorded command exits zero.
- [ ] Record verification in #1340 and prepare the single-purpose PR after separate publication approval.
- [x] 2026-08-21: Addressed PR review findings for durable successor evidence, terminal Worker failure propagation, production dialog request shape, YAML create bootstrap, and YAML-content logging; scoped typecheck completed 193/193 tasks and scoped test completed 98/98 tasks.

## Surprises and discoveries

- The fixed coordinator correctly persists `allowed | revoked | rejected`, but an existing `initializeOriginCoordinator()` call turns every rejected HELLO into a generic `HELLO_REJECTED`. The application therefore cannot currently distinguish the expected post-activation `LEGACY_YAML_ACCESS_REVOKED` state from terminal rejection.
- The dormant activation reducer can issue `canonical-ready` only after an in-memory same-runtime v1-to-v2 transition. Its provenance is intentionally not serializable, so a successful reload loses the ready state and needs a separately specified strict constructor.
- The winning window's owned-client creation gate is monotonically revoked during quiescence. It cannot safely create a new SharedWorker after migration. A new JavaScript runtime is therefore required after successful commit and initialization.
- At the plan start, `CoreDB` registered only logical version 1 / native version 10. This matched the pre-activation contract and left logical version 2 / native version 20 to be introduced exclusively by #1340; the completed implementation now registers both logical schemas while refusing unplanned upgrades.
- At the plan start, the YAML plugin preload opened YamlDB in the application window before runtime creation. The implementation removes that production preload rather than repurposing it as an activation gate.
- The generic TreeNode updater already sends draft metadata and draft data in one `updateTreeNode()` request. The canonical dialog connector can validate the exact YAML input and delegate to one internal updater operation without adding a second write.
- A genuinely fresh installation has no CoreDB. Treating missing as a terminal preflight error would permanently block new users, so only the sole allowed/quiesced executor receives a distinct oldVersion-0 fresh-v2 path. Revoked successor inspection still treats missing as terminal.
- The fixed coordinator intentionally returns `LEGACY_YAML_ACCESS_REVOKED` for both active `quiescing` and durable `ready-for-preflight`; application code must strictly reread the existing durable record before constructing successor evidence.
- Dexie logical CoreDB versions 1 and 2 are persisted by IndexedDB as native versions 10 and 20. The original connector incorrectly used native 1 and 2, so raw discovery, target open, and schema validation could not interoperate with a real `CoreDB` instance.

## Decision log

- Decision: Keep the accepted coordinator script and its static import graph byte-for-byte unchanged.
  Rationale: #1338 acceptance fixed this artifact through activation completion. The missing successor behavior belongs in activation-aware application and runtime clients, not the Service Worker.
  Date: 2026-08-21.

- Decision: Use distinct Web Crypto UUIDs for every activation contender and let the coordinator's atomic `allowed` to `revoked/quiescing` transition select the only executor.
  Rationale: A shared fixed identity lets two already-accepted windows observe the same ready result and both start preflight. Distinct identities make every loser receive an identity mismatch before storage access.
  Date: 2026-08-21.

- Decision: Use a success-only reload after the winner has reached canonical-ready, rather than resetting the winner's local owned-client gate.
  Rationale: The local revocation gate is deliberately monotonic and must not be reset. Reload after full quiescence, commit, and initialization is a runtime handoff, not a retry or stale-client bypass.
  Date: 2026-08-21.

- Decision: A revoked successor boot requires exact CoreDB logical v2 / native v20 topology, exact journal schema, a full canonical-only raw YAML validation pass, and current initialization.
  Rationale: The version pair alone is insufficient evidence, and a journal row count cannot be required because a fully canonical or empty logical v1 / native v10 database can legitimately migrate with zero journal rows.
  Date: 2026-08-21.

- Decision: Do not implement interrupted-v1 automatic recovery in #1340.
  Rationale: A new target open would violate the no-retry and same-open-request contract. Interrupted activation stays terminal until a separately specified and approved recovery release exists.
  Date: 2026-08-21.

- Decision: Implement #1388 as one build-fixed incident recovery, never as generic
  `revoked + missing => fresh create` successor behavior.
  Rationale: The durable revoked state cannot distinguish a genuinely interrupted incident from a
  later manual deletion. The exact coordinator fingerprint, strict database inventory, and a
  separately created origin-wide claim database bind the exceptional write to the approved
  production state and select one executor without changing the fixed coordinator.
  Date: 2026-08-21.

- Decision: Diagnose the rejected historical `hidb-core` catalog entry through a separate
  source-controlled read-only mode before defining any recovery amendment.
  Rationale: `RECOVERY_INTERRUPTED_CORE_CATALOG_MISMATCH` proves only that the database is not the
  approved native-v2 state. Publishing its sanitized observed native version, logical-v2 topology
  status, and total record count avoids guessing while leaving `incident-1388-v1` terminal and
  unchanged.
  Date: 2026-08-21.

- Decision: After production evidence identified the literal historical `hidb-core` as native
  version 10 but not logical-v2 topology, diagnose exact logical-v1 topology through a new mode.
  Rationale: Native version 10 alone is not schema evidence. The new mode requires that exact native
  version, reuses the runtime-worker logical-v1 schema authority, and counts records only after an
  exact topology match. It is not a retry, fallback, or change to the #1388 recovery acceptance set.
  Date: 2026-08-22.

- Decision: Classify the non-empty logical-v1 `hidb-core` snapshot before defining any copy or
  migration recovery.
  Rationale: Production evidence reports 15 records while the persisted initializer cohort contains
  12. The classifier must account for every record in one readonly transaction, distinguish exact
  initializer records, modified initializer identities, additional records, and invalid records,
  and reuse the YAML migration planner without publishing raw values. Historical initializer shape,
  not a newer TypeScript declaration, is the default-cohort authority: the initializer deliberately
  persisted `metadata.description: undefined` and omitted `visible`. The historical
  `tagAssociations` store indexes `createdAt` while the record contract stores `assignedAt`; the
  classifier validates the exact record field and referential relation and does not synthesize an
  indexed timestamp. These historical mismatches are evidence to preserve, never fields to default,
  normalize, or repair.
  Date: 2026-08-22.

- Decision: Treat a genuinely missing CoreDB as a distinct same-activation fresh-v2 creation, not
  as an empty v1 migration or a revoked successor recovery.
  Rationale: New installations otherwise stop permanently at `CORE_DB_NOT_FOUND`. The sole
  quiescence winner can safely create exact logical v2 / native v20 with one oldVersion-0 target request, while a
  successor missing the database still indicates corruption or deletion and remains terminal.
  Date: 2026-08-21.

- Decision: Confirm an exact durable `revoked/ready-for-preflight` record in the application after
  a revoked HELLO and before creating the canonical Worker.
  Rationale: The byte-fixed coordinator HELLO intentionally collapses active `quiescing` and ready
  into the same revoked code. A single strict read preserves the fixed coordinator graph while
  preventing an in-progress activation from being promoted to successor evidence. The read never
  polls, mutates coordinator state, or exposes participant identities.
  Date: 2026-08-21.

- Decision: Keep logical CoreDB v1/v2 in activation state, migration plans, and journal metadata,
  while using exact native IndexedDB v10/v20 for catalog, raw open, versionchange, and schema checks.
  Rationale: Dexie owns the logical-to-native representation and persists these exact versions.
  Mixing the two domains created native v2 and then forced real Dexie initialization to attempt a
  second upgrade to native v20. Native v1/v2 is not accepted as a compatibility form.
  Date: 2026-08-21.

## Context and orientation

The fixed origin coordinator lives in `app/src/origin-coordinator/originCoordinator.worker.ts`, `OriginCoordinatorServiceWorker.ts`, `originCoordinatorStateDbUtils.ts`, and `originCoordinatorValidatorUtils.ts`, together with `packages/origin-coordinator`. Those files form the accepted coordinator graph and are read-only for this issue. Application-side coordinator initialization is in `app/src/origin-coordinator/initializeOriginCoordinator.ts` and may change because it is not part of the Service Worker static graph.

At the plan start, the application bootstrap in `app/src/entry.client.tsx` accepted only an allowed HELLO and then initialized browser globals, plugin worker preloads, and the router. Worker clients are created from `app/src/worker-runtime/clientUtils.ts`; SharedWorker and dedicated Worker entries live beside it. `workerBootstrapUtils.ts` constructs `WorkerService`, which opens `CoreDB` from `packages/runtime-worker/src/services/CoreDB.ts` and exposes the generic Worker facade.

The strict dormant artifacts available at the plan start were:

- `@hierarchidb/yaml-api/migration` plans v1 raw payload migration and journal values.
- `@hierarchidb/yaml-api/validation` validates canonical payloads.
- `@hierarchidb/runtime-worker/yaml-storage-activation` issues activation states and access decisions.
- `@hierarchidb/runtime-worker/yaml-storage-legacy-fence` models quiescence evidence.
- `@hierarchidb/yaml-plugin/canonical-writer` validates one dialog write and calls one injected port.
- `@hierarchidb/folder-plugin/canonical-yaml-zip-plan` plans canonical ZIP import/export.
- the pre-activation `@hierarchidb/simulation-workflow/canonical-yaml-snapshot` consumer, since replaced by the production package-root `SimulationWorkflow`.

The implementation removes the legacy reachability that existed in the YAML plugin preload, `@hierarchidb/yaml-store` mutation exports, folder-plugin root YAML helpers, and the earlier SimulationWorkflow root implementation.

## Implementation plan

### Milestone 1: strict canonical successor state

Extend the activation state types with an explicit readiness proof. Forward activation produces `same-activation-upgrade`; a new strict post-activation constructor produces `post-activation-boot`. The constructor accepts `unknown`, validates exact own data properties without invoking accessors, requires a revoked/ready gate, equal positive safe observed and target versions, exact schema validation, canonical snapshot validation, successful current initialization, and a non-empty current open request ID. It issues a frozen provenance-bearing canonical-ready state. Any malformed or incomplete evidence returns a sanitized typed error and no state.

Keep `getYamlStorageAccessDecision()` unchanged in authority: only an issued canonical-ready state allows canonical runtime operations, and every other state denies. Add property-based and table tests for extra fields, accessors, proxies, wrong versions, incomplete evidence, fabricated states, and both readiness proofs.

### Milestone 2: CoreDB logical v2 / native v20 activation connector

Add a production-only runtime-worker subpath for the activation and successor inspection boundary. It must not enter the fixed coordinator graph. The connector will:

1. Resolve the exact CoreDB name and inspect the existing database without registering logical v2 / native v20.
2. For initial activation, require observed logical v1 / native v10, exact v1 stores needed by CoreDB, and one readonly raw `nodes` snapshot.
3. Select every exact-own `nodeType === "yaml-file"` record and call the existing migration planner with caller-supplied identifiers and a Web Crypto SHA-256 port.
4. Retain the immutable raw snapshot and successful plan only in memory.
5. Close the preflight connection and create exactly one CoreDB logical v2 / native v20 open request.
6. Register `yamlMigrationJournal` with `&[migrationId+nodeId+slot],[migrationId+fromCoreDbVersion+toCoreDbVersion]`.
7. In the versionchange transaction, reread the full raw YAML cohort, compare every guarded field and slot to the preflight snapshot, then update all planned node slots and journal rows atomically. No digest, network, timer, or external promise runs inside the transaction.
8. Abort the whole upgrade on any cohort, value, node-version, write, or journal mismatch.
9. Initialize CoreDB after commit, validate the resulting raw canonical cohort, and advance the same activation state to canonical-ready.

Normal CoreDB construction registers logical v2 / native v20 but refuses an existing logical v1-to-v2 upgrade unless the activation connector supplies the validated plan. A missing database uses the same quiescence winner and open request to create exact native v20 directly, then initializes and validates before readiness. A revoked successor never uses this path. `WorkerService.getSingleton()` must no longer be reachable from the allowed pre-activation bootstrap.

For successor boot, inspect exact logical v2 / native v20 and IDB topology before constructing WorkerService. Validate the `yamlMigrationJournal` key path and cohort index, read every raw YAML node once, require the migration planner to classify every non-placeholder slot as already canonical and produce zero migrate entries, then initialize WorkerService and create the strict post-activation canonical-ready state.

### Milestone 3: activation-aware application bootstrap

Refactor application-side coordinator initialization to return a discriminated boot gate:

- `activation-allowed` includes the existing coordinator client handle and installed bridge responder.
- `canonical-revoked` carries only strict evidence that HELLO returned `LEGACY_YAML_ACCESS_REVOKED`.
- every other rejection throws a stable terminal client error.

When allowed, `entry.client.tsx` generates distinct activation and quiescence UUIDs, starts quiescence, and proceeds only for the winning identity and exact `ready-for-preflight`. It calls the activation connector without initializing browser globals, plugin preloads, router, WorkerService, or SharedWorker. After same-activation canonical-ready it closes the activation CoreDB connection and invokes an explicit success-only reload handoff.

When revoked, the application starts the canonical-only Worker path. The Worker validates v2 and initializes before exposing Comlink. Only after the Worker reports an issued post-activation canonical-ready decision may the application initialize canonical browser globals and the router. It never calls the legacy YAML preload.

The React entry mounts only a minimal bootstrap container before this decision. Importing the root
component performs no browser-global initialization. `AppRoot`, `AppProviders`, `WorkerProvider`,
and `RouterProvider` remain unmounted through activation, reload handoff, and terminal failure. On a
successor boot, the fixed order is canonical WorkerAPIClient preparation, browser-global
initialization, router creation, and one provider-tree mount. That mount reuses the prepared client
through the shared loader cache. The static hydrate fallback is removed only after the ready tree
commits and remains visible for reload or terminal failure; no retry or legacy fallback is added.

Replace the current generic IndexedDB reset detection so activation-specific errors cannot match or render the reset control. Existing unrelated database recovery behavior remains unchanged.

### Milestone 4: canonical production routes

Connect the canonical writer inside `TreeNodeUpdaterService`. For `yaml-file`, public draft metadata/data split methods reject direct mutation. `updateTreeNode()` derives the exact canonical writer input from the one supplied draft request, invokes `writeYamlCanonicalDialogDraft()`, and lets its injected port call one internal unchecked updater operation. Both save and save-draft require exact filename, description, tags, subtype, schemaId, and content; they never auto-rename or merge a partial payload.

Guard every production YAML query and mutation path with the same canonical-ready decision. Generic TreeNode creation permits only the explicitly specified temporary YAML placeholder or a complete canonical postimage. Update validates the complete resulting committed and draft slots before one transaction. Delete acts on CoreDB only. No path reads or writes YamlDB.

Publish canonical folder ZIP connectors from the production folder route. Export obtains one authoritative CoreDB snapshot for the caller-selected committed or draft slot, validates node guards, then returns the deterministic archive. Import obtains the parent, sibling, and existing-ID snapshot, plans all nodes, and commits the issued plan through one CoreDB transaction port. The transaction rechecks every guard and either inserts all nodes plus the parent patch or inserts none.

Replace the SimulationWorkflow root implementation with the canonical committed snapshot workflow and change `runSimulation()` to `Promise<void>`. Remove the legacy return payload and serializer dependency without adding an alias.

### Milestone 5: remove the legacy production graph

Remove `registerYamlWorkerStores` from the YAML plugin manifest and worker entry. Remove YamlDB mutation functions from the package root and delete production imports. Keep only the read-only/close boundary needed by #1341; do not delete the physical database.

Remove `exportYamlNodesToSnapshot` and `importYamlNodesFromSnapshot` from the folder-plugin root, delete their production implementations when no test-only consumer remains, and replace the legacy round-trip tests with canonical ZIP/CoreDB connector tests. Remove the legacy Simulation serializer and update package dependencies and exports.

Update English and Japanese package READMEs and the canonical specification in the same commits as their implementation decisions. Run the dependency and naming guards to prove that dormant/legacy imports no longer enter the production graph.

## Concrete steps

All commands run from `/Users/hiroya/WebstormProjects/hierarchidb-wt/single-canonical-activation`.

1. Install the existing lockfile graph with `pnpm install --frozen-lockfile` if the worktree has no usable modules.
2. Implement Milestone 1 and run the runtime-worker activation unit tests and filtered typecheck.
3. Implement Milestone 2 with fake-indexeddb tests covering v1 success, blocked/resume identity, raw mismatch, journal failure, all-canonical no-op, empty database, v2 successor success, and invalid v2 rejection.
4. Implement Milestone 3 and run app origin-coordinator/bootstrap/worker-entry unit tests. Verify the fixed coordinator graph has no diff from accepted source `f297cdc70a4e1665e1d26d4d931563af1e05bcd9`.
5. Implement Milestone 4 package by package, with one focused test suite after each connector.
6. Implement Milestone 5, regenerate plugin registry, and run reachability searches before the full matrix.
7. Run every verification command from #1340, inspect generated changes, and record exit codes and sanitized results in the Issue after separate external-write approval.

## Validation and acceptance

Focused validation must establish these observable behaviors:

- Two distinct activation attempts produce exactly one storage executor; the loser performs zero CoreDB reads and writes.
- Quiescence failure performs zero preflight reads. Preflight failure performs zero v2 open requests. A blocked open keeps the same request and publishes no API.
- The versionchange transaction writes every planned node and journal row or none. A changed node, changed slot, extra/missing YAML node, or journal failure aborts the upgrade.
- Same-activation canonical-ready occurs only after commit and initialization. Success-only handoff is called exactly once and only from that state.
- Revoked + exact canonical v2 + current initialization publishes canonical access. Revoked + v1, invalid/future version, invalid schema, legacy slot, invalid canonical slot, or failed initialization publishes nothing.
- Dialog save and save-draft perform one updater request. Invalid input performs zero writes.
- ZIP import creates all CoreDB nodes and the parent patch in one transaction or none. ZIP export and Simulation read committed canonical CoreDB nodes only.
- No production import reaches a YamlDB writer, legacy folder ZIP serializer, or legacy Simulation serializer.
- Fixed coordinator files and their static imports are unchanged from the accepted source.

The final command matrix is the one recorded in #1340. Every command must exit zero. `git diff --check` must be clean, and no generated JavaScript or source map may appear under a `src` directory.

## Idempotence and recovery

Read-only inspection and canonical successor validation are safe to rerun on an already canonical v2 database. They perform no migration writes and do not use journal row count as readiness proof.

The initial v1-to-v2 target open is deliberately not retryable. A failed or aborted versionchange leaves the upgrade uncommitted, while the durable coordinator remains revoked. The application does not restore allowed state, reopen v1, delete databases, or try a second open. This terminal condition requires a separate reviewed recovery release.

Issue #1388 supplies that separate release only for its exact accepted incident state. A diagnostic
build with recovery disabled first runs read-only `recovery-pre`, records the deterministic
coordinator fingerprint and strict inventory, and closes the diagnostic page. The same exact source
is then rebuilt with mode `incident-1388-v1` and that 64-hex fingerprint. The revoked successor path
creates `<prefix>-yaml-storage-recovery` native v1 with one exact `claimed` record as the atomic
origin-wide claim, then creates only the exact canonical CoreDB name at native v20 from oldVersion
zero, initializes and validates it, changes the record to `completed`, and reloads only on success.
The historical `hidb-core` and YamlDB are read-only evidence and are never copied, renamed, deleted,
or repaired. Any failure or existing claimed record is terminal. Recovery-post must prove the same
baseline and completed claim; the accepted production follow-up is rebuilt with recovery explicitly
disabled. Generic revoked successor behavior continues to reject missing CoreDB.

Once logical v2 / native v20 commits, exact or release inverse migration can only run as a newer CoreDB logical/native version pair under the rollback contract. The release never downgrades the IndexedDB native version. YamlDB remains untouched for the #1341 recovery window.

## Artifacts and notes

The accepted stable coordinator evidence is:

- source: `f297cdc70a4e1665e1d26d4d931563af1e05bcd9`
- deployment: `e94912deb29e3cc44278b21c4128ed377d1b0ed6`
- coordinator SHA-256: `674f8172afabfec3b13cf91a3491d8baa99a2b64c6f2d626952766b11b2ad9d4`

The production CoreDB inventory accepted before activation reported `status=accepted`, `invalidRecordCount=0`, and `errorCount=0`. It is historical gate evidence only; activation still rereads and validates the current post-quiescence raw snapshot.

## Interfaces introduced or changed

The exact names may change only if the naming audit requires a more specific primary-export match; their responsibilities may not broaden.

- `createYamlStoragePostActivationReady(input: unknown)` in `@hierarchidb/runtime-worker/yaml-storage-activation` issues a strict post-activation canonical-ready state or a sanitized input error.
- `createYamlStorageFreshActivation(input)` issues currentVersion-zero state only after authoritative missing-database discovery; its ready proof is `same-activation-fresh-create`.
- `activateYamlStorageCoreDb(input)` in a production-only runtime-worker subpath performs either the one v1-to-v2 plan/open/upgrade/initialize sequence or the distinct one-request fresh-v2 creation and returns the issued same-activation state.
- `inspectCanonicalYamlStorageCoreDb(input)` performs exact v2 schema and canonical raw snapshot validation without writes.
- The application-side coordinator initializer returns `activation-allowed | canonical-revoked` instead of erasing the HELLO rejection reason.
- The production Worker bootstrap returns or retains an issued `YamlStorageCanonicalReadyState` and uses it to guard its Comlink facade.
- `SimulationWorkflow.runSimulation()` changes from `Promise<string>` to `Promise<void>` and uses only the canonical committed snapshot implementation.

No compatibility alias, dual writer, feature flag for storage authority, default subtype, read fallback, or retry interface is introduced.

## Outcomes and retrospective

The local implementation now provides one canonical CoreDB activation and successor graph. It keeps
the accepted coordinator byte-identical, adds the one-executor v1-to-v2 or fresh-v2 activation path,
requires strict post-activation validation before Worker API publication, routes dialog and generic
CRUD through guarded CoreDB writes, publishes canonical folder ZIP operations, switches Simulation
to the committed canonical snapshot, and removes production reachability to the legacy writers and
serializers. No compatibility fallback, dual writer, retry, database reset, or default payload repair
was introduced.

Validation against current `main` completed with these results:

- frozen install and plugin registry generation: exit 0, generated registry unchanged;
- filtered typecheck: 197 of 197 Turbo tasks successful;
- filtered package tests: 58 of 58 Turbo tasks successful, including 351 runtime-worker, 58 folder,
  45 YAML plugin, 7 Simulation, and 2 yaml-store tests; the three application activation suites add
  15 passing tests;
- filtered build: 100 of 100 Turbo tasks successful;
- repository lint: 14 of 14 available lint tasks successful;
- strict dependency fence: all packages passed; the additional dependency guard exited zero with
  its 13 repository baseline warnings;
- fixed coordinator graph diff: empty; built coordinator SHA-256 matches the accepted value;
- naming CI comparison: 3 base errors to 3 head errors, zero new errors;
- `git diff --check`: clean; no generated JavaScript or source map exists under a `src` directory.

The repository-wide raw format and naming commands recorded in #1340 cannot currently satisfy their
literal exit-zero expectation without unrelated cleanup. `pnpm format` stops at the pre-existing
`packages/ui/tour/src/components/GenericGuidedTour.tsx` nested-component violation and can rewrite
unrelated files before stopping. A non-writing Biome comparison over the files changed by this branch
reports 23 base errors versus 15 head errors, so this branch introduces no new violation. The raw
naming audit reports the same three base-existing primary-export violations at head, while the
workflow's base/head comparison exits zero. The Issue verification text must use the repository's
non-regression form, or the unrelated baseline must be resolved under separately approved scope,
before the Issue can truthfully claim every listed command exits zero.

External publication and Issue status updates remain pending explicit approval. YamlDB physical
recovery and retirement remain follow-up work for #1341 or a later Epic lane.
