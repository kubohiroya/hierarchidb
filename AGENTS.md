# AGENTS.md — Operational Rules (English Edition)

## 0. Quick-Start Checklist (read before any task)
- **Language**: converse in clear, polite Japanese; write code comments/docs in English unless told otherwise.
- **Grid usage**: use Material UI v7 `Grid` (new API, no `container`/`item`, prefer `size` props). No `GridLegacy`.
- **Task source of truth**: use GitHub Issues as SSOT. Update labels/comments/logs on the relevant issue before modifying code (see `docs/policies/ISSUE-BASED-TASK-MANAGEMENT.md`).
- **Verification**: run `pnpm -C <package> typecheck` and `pnpm -C <package> build` (if defined) for every touched package. For multi-package impact, run `pnpm -w typecheck` (and build if needed).
- **Completion report**: list executed commands + success status. If a command cannot run (sandbox, network), explain why and provide fallback.
- **Changes**: keep diffs small, scoped, and linked to documented tasks.

## 1. Agent Update Process
1. **Before coding**: read this file + the relevant GitHub Issue(s); acknowledge new instructions in the conversation.
2. **When rules change**: append/update the relevant section here first (especially the checklist) and, if the task tracking flow changes, update `docs/policies/ISSUE-BASED-TASK-MANAGEMENT.md` accordingly.
3. **Version trace**: maintain a "Change Log" at the bottom with date + short note (latest on top).
4. **Reminders**: create TODOs in `TASKS.md` if longer follow-ups are required.

## 2. Execution Rules
### 2.1 Build & Typecheck (mandatory)
- Run per package touched: `pnpm -C <package> typecheck`; `pnpm -C <package> build` if available.
- For cross-package or unknown scope: `pnpm -w typecheck`, optionally `pnpm -w build`.
- Fix failures immediately; do not submit with red builds.

### 2.2 Result Reporting
- Always list commands executed with package context and outcome.
- If constraints block execution, state the reason, run a degraded check (e.g., `tsc --noEmit`), and request user execution if necessary.

### 2.3 Change Scope & Records
- Deliver minimal, reversible diffs.
- Keep doc/type updates alongside code changes.
- No unrelated cleanups.

## 3. Coordination
- If deeper-file AGENTS.md exists, obey the more specific one in that scope.
- Stop immediately if unexpected repo changes appear; ask the user how to proceed.
- Follow the repo "Motto": *Small, clear, safe steps — always grounded in real docs.*

## 4. Workflow Guidance
1. **Plan**: outline short actionable steps before major edits.
2. **Read**: inspect relevant files fully before changing them.
3. **Implement**: keep modules focused and ≤300 LOC when possible; comment only where logic isn’t obvious.
4. **Verify**: re-read modified code; ensure formatting and lint expectations.
5. **Test & Doc**: add/adjust tests and docs for every feature or fix.
6. **Reflect**: address root causes; note adjacent risks or TODOs.

## 5. Code Style Notes
- Write English comments; add rationale for non-trivial logic.
- Concentrate config defaults in shared config files; avoid magic numbers.
- Prefer clarity over cleverness; avoid new dependencies unless justified.

## 6. Testing Notes
- WFL (Worker-FIDB Loop): UI integration tests via WorkerAPIClient + fake-indexeddb.
- Use context7 MCP server to fetch current docs before coding.
- Verify external APIs with `resolve-library-id` → `get-library-docs`.
- Pause and clarify when unsure.

## 7. Collaboration & Accountability
- Escalate ambiguous, security-sensitive, or contract-changing requirements.
- If confidence <80%, say so and ask questions.
- Personal scoring guideline: −4 for wrong/breaking changes, +1 for successful changes. Honesty yields 0 (no penalty).
- Prioritize correctness over speed.

## 8. Change Log
- 2025-09-29: Converted AGENTS.md to English checklist-driven format; added explicit MUI v7 Grid rule and update process.
- 2025-09-29: Switched SSOT from `TASKS.md` to GitHub Issues; linked to `docs/policies/ISSUE-BASED-TASK-MANAGEMENT.md` and updated pre-work checks.
