# IDE-GSM Build Session Integration Specification

This document is the normative contract for representing asynchronous IDE-GSM server commands as HierarchiDB Build Sessions.

The integration covers commands launched from an `idegsm-project` node and shortcuts launched from an `fdm` node. IDE-GSM remains the authoritative task system. HierarchiDB projects server task state into the existing AppBar Build Session UI and provides progress inspection and cancellation without creating a second execution authority.

If this document conflicts with Build Session text in `idegsm-project-node-spec.md`, `fdm-node-spec.md`, or `yaml-plugin-ide-gsm-step4-spec.md`, this document takes precedence for IDE-GSM Build Session behavior.

## Scope

In scope:

- AppBar visibility for asynchronous IDE-GSM commands, initially `sim`, `calib`, and `check`.
- Projection of IDE-GSM task state into the canonical Build Session runtime model.
- Navigation from an AppBar item to a shared IDE-GSM progress screen.
- Server-derived progress, phase, live-only task logs with a runtime-only client buffer, result, and error display.
- Cancellation through the existing IDE-GSM `cancelTask(taskId)` mutation.
- Subscription reconnect while the runtime knows the server task ID.
- Browser-reload recovery through a new authenticated active-task discovery query.
- FDM command shortcuts delegating to the owning `idegsm-project` session.

Out of scope:

- Making HierarchiDB authoritative for IDE-GSM execution state.
- Client-side execution, pause, resume, retry, or offline command queues.
- Persisting task IDs, authoritative status, progress events, or log bodies in client databases.
- Mapping cancellation to the existing pause semantics.
- Supporting multiple simultaneous active IDE-GSM commands for one `idegsm-project` in the initial implementation.
- Server-side task-log persistence, history queries, paging, search, cursor replay, or recovery of lines missed while disconnected.
- Recovery of task/log state across an IDE-GSM API server process restart.

## Existing HierarchiDB Surface

The implementation must extend the current shared Build Session surfaces:

- `packages/build-api`: canonical runtime record, statuses, filters, and runtime adapter contracts.
- `packages/ui/build-sessions`: shared session state and subscription integration.
- `packages/ui/build-progress`: progress screen and build-control presentation.
- `app/src/components/BuildSessionQueuePanel.tsx`: AppBar queue/list presentation.
- `app/src/components/BuildSessionQueueSessionRow.tsx`: session row presentation.
- `app/src/router/pages/tree/console/TreeConsoleAppBar.tsx`: AppBar composition and navigation.

The IDE-GSM integration must not add a separate global task icon, queue, or incompatible progress framework.

## Ownership And Packages

Responsibilities are divided as follows:

- IDE-GSM server: task creation, task ID, status, progress source, live log events, result, authorization, cancellation, and active-task discovery for the current server runtime.
- `packages/ide-gsm-client`: typed `activeProjectTasks`, `getTaskStatus`, `subscribeTaskOnFrontend`, live-only `subscribeTaskLog`, runtime-event subscription, and `cancelTask` methods.
- `packages/idegsm-project-api`: external-session DTOs, status mapping, command/session control ports, and stable public error codes.
- `plugins/idegsm-project-plugin`: command launch UI and project-specific progress-screen composition.
- `packages/build-api`: canonical external Build Session runtime contract and `canceling` / `canceled` statuses.
- `packages/ui/build-sessions` and `packages/ui/build-progress`: shared AppBar session and progress presentation.
- app-level composition: runtime-only IDE-GSM session registry, subscription lifetime, Build Session adapter registration, and AppBar aggregation.
- `fdm-plugin`: optional shortcut only; it resolves and delegates to the owning `idegsm-project` and does not own a duplicate session.

## Session Identity And Concurrency

The initial canonical session identity remains:

```ts
{
  nodeType: 'idegsm-project';
  nodeId: NodeId;
}
```

The runtime record additionally associates the projection with an IDE-GSM `taskId` and command ID in app-level memory.

Only one pending start request or active asynchronous IDE-GSM command is allowed per `idegsm-project` node. While either exists, another `sim`, `calib`, `check`, or other asynchronous project command for that node is rejected before a network request with a stable code such as `ACTIVE_IDEGSM_TASK_EXISTS`.

A new command may replace a terminal local projection after common Build Session retention/dismissal rules have been applied. Replacement or dismissal of a local projection must not call `removeTask` or delete server-side history.

Supporting concurrent tasks for one project requires a future version of the canonical Build Session identity that includes an independent session ID. Synthetic TreeNode IDs must not be created to bypass this limitation.

## Command Launch Request State

The interval before a valid server `taskId` is returned is not a Build Session. It is a separate node-scoped, runtime-only command launch request owned by the project command UI/service.

The initial launch state is exactly `idle | submitting`. While `submitting`, Step 3 and context-menu command actions for the same project are disabled and the initiating surface shows local pending feedback such as an inline spinner. This state is not published to the AppBar Build Session list, does not use `BuildSessionRuntimeStatus`, has no progress/log screen, and cannot call `cancelTask` because no validated server task identity exists.

Receiving and validating `taskId` atomically hands ownership from the launch request to the external Build Session registry: the local `submitting` state is cleared and one canonical session is registered. A pre-task-ID validation, transport, GraphQL, or response-shape failure clears `submitting`, exposes a stable launch error on the initiating UI, and creates no Build Session.

If the server may have accepted a command but the response containing `taskId` is lost, the client must not invent a task ID or automatically resend the command. Subsequent authenticated `activeProjectTasks` discovery may recover the server task and register it as a Build Session. The pending launch record, errors, and timing are ephemeral and must not be persisted in TreeNode, CoreDB, plugin stores, IndexedDB, URL state, or analytics.

## Start Lifecycle

Starting an asynchronous command follows this sequence:

1. Resolve the originating `idegsm-project`, its compound logical identity `(connectionName, projectRelativePath)`, credentials, and command capability.
2. Reject feature-disabled, disconnected, unhealthy, unauthorized, invalid-target, pending-start, or duplicate-active-session cases before the command request.
3. Generate one ephemeral UUID `clientRequestId`, enter the separate local `submitting` launch state, and send the mapped IDE-GSM command mutation. `sim`, `calib`, and `check` map to `simulate`, `calibrate`, and `checkProject` respectively.
4. Receive and validate the returned `taskId`.
5. Clear the launch state and register the external Build Session projection as one ownership handoff.
6. Subscribe to `subscribeTaskOnFrontend(taskId)` and relevant runtime progress/log events.
7. Publish validated projections to the AppBar Build Session adapter until a terminal server status is received.

Failure before a valid `taskId` does not create a Build Session and is handled only by the launch request UI. Failure after a valid task ID is received but before subscription creates a visible reconnecting/diagnostic Build Session projection and attempts state recovery through `getTaskStatus(taskId)`; it must not silently discard a server task that may still be running.

The server deduplicates the same `(owner, projectRelativePath, clientRequestId)` and rejects a different project-command request while an existing `sim`, `calib`, or `check` task for that owner/project is active. The client does not automatically replay a request after an ambiguous transport failure; it uses active-task discovery and the original in-memory request ID while the launch attempt remains in the current runtime.

## Status Mapping

IDE-GSM is the status authority. The adapter uses this exact mapping:

| IDE-GSM state | Canonical Build Session state | Active |
| --- | --- | --- |
| `REGISTERED`, `READY` | `starting` | yes |
| `LEASED` | `running` | yes |
| cancellation request in flight or accepted, terminal state not received | `canceling` | yes |
| `FINISHED` | `completed` | no |
| `CANCELED` | `canceled` | no |
| `FAILED` | `failed` | no |
| `DELETED` | `failed` with an unsupported-terminal-state code | no |

`packages/build-api` must add `canceling` and `canceled` to `BuildSessionRuntimeStatus`, canonical status validation, active-status detection, filters, AppBar rendering, and progress controls. Existing local Build Session adapters must retain their current behavior.

Cancellation must not be represented as `pausing`, `paused`, or `failed`. Subscription loss is not a server terminal state and must not be converted to `failed` without a failed recovery result.

## Progress Projection

The Build Session adapter may publish:

- command ID as the current action type;
- server runtime phase as the current action phase;
- server progress percentage when explicitly provided and valid in `0..100`;
- elapsed time derived from server timestamps when available, otherwise from the local observation start;
- bounded current message and recent log excerpts suitable for compact UI display.

The client must not synthesize percentage from task status alone. If IDE-GSM supplies only `REGISTERED`, `READY`, or `LEASED`, the AppBar uses indeterminate progress. Unknown phases and malformed percentages are rejected or shown through stable diagnostic state; they are not normalized into invented progress.

## AppBar Presentation

An active IDE-GSM task appears in the existing AppBar Build Session list alongside local builds. The item displays at least:

- originating node name and tree path;
- IDE-GSM command name;
- mapped session status;
- progress percentage or indeterminate progress;
- elapsed time;
- current server phase or safe message;
- connection/reconnecting affordance when applicable.

Selecting the item opens the progress screen without starting, retrying, or mutating the task. Closing the AppBar menu or navigating elsewhere must not stop the subscription or cancel execution.

Terminal items may remain in the recent-session list according to the common retention policy. Dismissal removes only the local projection.

## Progress Screen

The progress screen reuses `packages/ui/build-progress` and provides IDE-GSM-specific details through adapters. It displays:

- node and logical project identity;
- command ID and server task ID in a diagnostic field that is not placed in URLs;
- authoritative mapped status and current phase;
- progress and elapsed/remaining time when the server provides enough data;
- live log output received during the current browser runtime;
- subscription and reconnect state;
- terminal result summary or stable public error;
- cancellation control for cancellable active tasks.

Pause and resume controls are hidden because the current IDE-GSM task contract does not provide pause/resume semantics. Retry is not automatic. A future explicit retry action must create a new server task and a new session lifecycle.

## Virtualized Progress Log Dialog

The IDE-GSM progress screen must open a dedicated row-oriented text log dialog implemented through a reusable `VirtualizedTextLogDialog` component in `packages/ui/build-progress`. IDE-GSM-specific subscription, task, reconnect, and cancellation behavior remains in the `idegsm-project` container/adapter; the shared dialog is a presentational consumer of an ordered runtime-only log buffer.

The log viewport must support vertical scrolling in both directions and virtualize rows so the number of mounted DOM rows remains bounded independently of the buffered log length. Each input row has a stable runtime ID, connection epoch, ordinal within that epoch, and text body; optional timestamp and severity fields may be presented without changing the original text. Log text is rendered as text, never interpreted as HTML. The dialog must not persist rows or create an authoritative log store.

The viewport follows newly appended rows only while the final row is visible. Scrolling away from the final row suspends following and must preserve the user's viewport when new rows arrive. Whenever the final row is outside the visible range, a floating `VerticalAlignBottom` icon button is displayed at the horizontal center of the viewport's lower edge. Activating it scrolls to the final row, resumes following, and hides the button once the final row is visible. The control requires a tooltip and accessible label.

A search toolbar is fixed at the upper-right of the log display. It contains:

- a text search field;
- a `current match / total matches` display;
- an `ArrowUpward` previous-match icon button; and
- an `ArrowDownward` next-match icon button.

The initial search contract is a client-local case-insensitive literal substring search over the currently buffered rows, not a regular expression. An empty query has no selected match and displays `0 / 0`. A non-empty query highlights every matching buffered row; the current match receives a stronger distinct highlight. Previous/next navigation wraps between the first and last buffered match and uses the virtualizer's index navigation to reveal matches outside the mounted DOM range. Search controls are disabled when there is no match. Appended rows may increase the total, but the selected row and its ordinal remain unchanged. Search state is ephemeral dialog state and is not persisted.

The dialog uses a monospace log presentation, supports horizontal access to long lines, and may provide an explicit line-wrap toggle without changing log contents. Closing the dialog must not cancel the task, stop the app-level subscription, or clear the runtime buffer. Cancellation remains a separate explicit action that uses the canonical `cancelTask(taskId)` path.

## Live-Only Log Contract

The server publishes only log events produced after the current subscription becomes active. It does not retain or replay task log rows for this UI and does not provide task-log page or search queries.

The app-level container creates a new connection epoch for each successful live-log subscription. Rows are assigned stable runtime IDs from `(taskId, connectionEpoch, ordinal)`, where `ordinal` is strictly increasing within that local epoch. The transport preserves delivery order for one active subscription.

On WebSocket disconnect, the client preserves rows already buffered in the same browser runtime. After reconnect it appends one non-log gap separator and starts a new connection epoch from the first newly received row. It must not imply that lines emitted during the disconnected interval were recovered. Browser reload starts with an empty log buffer even when `activeProjectTasks` restores the task itself.

The runtime buffer is append-only while it accepts rows: existing rows are not deleted or rewritten during search or viewing. To avoid unbounded memory, the container enforces configured row and byte hard limits. When the next row would exceed either limit, it appends one `LOG_BUFFER_LIMIT_REACHED` marker, stops accepting further log rows for that task, and continues task-status subscription. It does not evict earlier rows. The UI clearly distinguishes gap/limit markers from server log text.

Search operates only over rows and markers currently present in this runtime buffer. Appends can add matches and increase the total, but cannot invalidate or renumber the selected existing match. No server-side search, historical match count, or recovery of missed matches is claimed.

## Cancellation

Cancellation uses the existing GraphQL mutation:

```graphql
mutation CancelTask($taskId: String!) {
  cancelTask(taskId: $taskId)
}
```

The control is enabled only when:

- the server task is active and cancellable;
- the selected connection is available;
- no cancellation request for the task is already in flight.

One user action sends one cancellation request. The Boolean result indicates request acceptance only. After acceptance, the local projection becomes `canceling` and continues subscribing until IDE-GSM reports `CANCELED`, `FINISHED`, or `FAILED`. A race in which completion wins over cancellation is displayed as `completed`.

Closing UI, losing the WebSocket, changing routes, or disconnecting the browser is never treated as cancellation.

## Reconnect And Reload Recovery

While app-level runtime still knows `taskId`, reconnect recovery performs:

1. `getTaskStatus(taskId)` to establish the current authoritative state.
2. Re-subscription through `subscribeTaskOnFrontend(taskId)` for active tasks.
3. A fresh live-log subscription with a new connection epoch and an explicit gap separator; no replay/backfill is attempted.
4. Monotonic projection update so stale events cannot overwrite newer server state.

Full browser-reload recovery requires a new authenticated IDE-GSM query:

```graphql
query ActiveProjectTasks($projectRelativePath: String!) {
  activeProjectTasks(projectRelativePath: $projectRelativePath) {
    taskId
    commandId
    status
    progress
    startedAt
    updatedAt
  }
}
```

The exact input wrapper may follow IDE-GSM GraphQL conventions, but the operation must be scoped by the resolved named connection, authenticated current user, and logical project path. `projectRelativePath` is unique only within a named connection; HierarchiDB project identity is the pair `(connectionName, projectRelativePath)`. It must not return tasks the current user cannot access. The returned information must be sufficient to reconstruct AppBar projections and resume subscriptions.

The client runs discovery after connection recovery and application bootstrap for loaded `idegsm-project` nodes. Duplicate results for a task already registered in runtime memory are merged by server task ID, not displayed twice.

## FDM Delegation

An FDM shortcut resolves `idegsmProjectNodeId` and invokes the owning project's command/session service. The resulting AppBar item uses:

- `nodeType: 'idegsm-project'`;
- the owning project node ID;
- the same server task ID and subscription;
- the same progress screen and cancellation port.

The FDM plugin must not create an `fdm` Build Session for the same task. If no owning project can be resolved, the shortcut fails before the command request.

## Persistence And Security

The following values are runtime-only:

- server task ID;
- command subscription handle;
- current authoritative task status;
- progress events;
- in-memory live-log buffer, connection epochs, search state, and log bodies;
- cancellation in-flight state;
- reconnect state;
- external Build Session projection.

They must not be stored in TreeNode `data` / `draftData`, CoreDB, plugin stores, IndexedDB, localStorage, URL parameters, or analytics payloads. `connectionName`, project/node identity, and other safe node metadata remain governed by the node specifications.

The authorized progress screen and log dialog may display log text returned for a task the current user is allowed to inspect. Diagnostic/public application logs, stable error messages, analytics, URLs, and persisted state must not expose endpoint URLs, GraphQL/WebSocket URLs, credentials, raw server responses, absolute server paths, raw command parameters, or task log bodies. Stable codes include at least:

- `ACTIVE_IDEGSM_TASK_EXISTS`
- `TASK_ID_MISSING`
- `TASK_SUBSCRIPTION_FAILED`
- `TASK_STATUS_RECOVERY_FAILED`
- `TASK_DISCOVERY_FAILED`
- `TASK_CANCEL_REJECTED`
- `CONNECTION_UNAVAILABLE`
- `CREDENTIALS_UNAVAILABLE`

## Acceptance Criteria

- Starting `sim`, `calib`, or `check` creates one AppBar Build Session item after a valid server task ID is returned.
- Before `taskId` exists, the initiating UI shows a separate local `submitting` state and the AppBar contains no session for that request.
- A pre-task-ID failure clears the local launch state, shows a stable launch error, and does not create or persist a Build Session.
- A second asynchronous command for the same `idegsm-project` is rejected while its first task is active.
- AppBar status and progress are derived from IDE-GSM server events without fabricated percentage.
- Selecting an item opens the shared progress screen and does not restart the command.
- The progress screen shows live-only buffered logs, server status, phase, timing, reconnect state, and terminal result/error.
- The progress log opens in a row-virtualized dialog whose mounted DOM row count stays bounded for a large runtime buffer.
- Scrolling away from the final row suspends following and shows a bottom-center button that restores the final-row view and following mode.
- The upper-right search controls show `current match / total matches`, highlight all literal case-insensitive buffered matches, distinguish the current match, and navigate cyclically through off-screen buffered matches.
- Search remains stable while logs are appended: the selected runtime row and ordinal remain unchanged, and newly appended matches update the total without moving a suspended viewport.
- Reconnect preserves already buffered rows, inserts a visible gap separator, and displays only newly delivered log rows without claiming replay.
- Reaching the row/byte hard limit preserves existing rows, adds one limit marker, and stops log capture without stopping task-status updates.
- Cancellation calls `cancelTask(taskId)` once, shows `canceling`, and waits for the authoritative terminal state.
- `CANCELED` maps to `canceled`, not `failed` or `paused`.
- Navigation, menu close, and progress-screen close do not cancel execution.
- FDM shortcuts produce one project-owned AppBar session and no duplicate FDM session.
- Known-task reconnect uses status recovery and a fresh live-log subscription without replay/backfill.
- Browser reload discovers active tasks through authenticated `activeProjectTasks` and deduplicates by server task ID.
- Task IDs, authoritative task state, progress events, and logs are not persisted in client-owned stores.
- Existing non-IDE-GSM Build Session adapters continue to pass their current contract tests after `canceling` / `canceled` are added.

## Test Requirements

At minimum, automated tests cover:

- every IDE-GSM-to-Build-Session status mapping;
- active-state detection for `canceling` and terminal detection for `canceled`;
- duplicate command rejection before network access;
- pending-start rejection, local submitting presentation, and absence of a pre-task-ID AppBar session;
- pre-task-ID failure cleanup and lost-response recovery without automatic command replay;
- missing/malformed task ID rejection;
- indeterminate progress when no percentage exists;
- stale subscription event suppression;
- reconnect status query followed by re-subscription;
- active-task discovery and task-ID deduplication;
- AppBar row rendering and progress-screen navigation;
- virtualized log rendering with a large runtime buffer and bounded mounted-row count;
- connection-epoch row identity, reconnect gap separator, and absence of replay claims;
- row/byte hard-limit handling that preserves existing rows and keeps task-status updates active;
- final-row visibility detection, follow suspension, bottom-center jump control, and follow restoration;
- case-insensitive literal matching over buffered rows, match counts, highlighting, cyclic previous/next navigation, and navigation to virtualized off-screen rows;
- appends during search preserving the selected runtime row and ordinal while updating the local total;
- cancellation idempotence and completion/cancellation races;
- FDM delegation without duplicate sessions;
- authorized log display plus diagnostic/error/analytics redaction and persistence-boundary checks;
- regression coverage for existing Build Session adapters.
