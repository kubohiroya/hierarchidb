# Location Plugin Follow-up Plan

The location plugin shares dialog and build UX patterns with shape/route plugins. After stabilizing shape, replicate the refactor here.

- [ ] Review existing documentation and source to capture the expected multi-step dialog and build workflows.
- [ ] Reintegrate multi-step dialog using `useDraft`, ensuring step components validate and persist state correctly.
- [ ] Restore build progress/recovery UI to call the real worker APIs (remove placeholders).
- [ ] Update path/tsconfig settings so UI code is type-checked alongside services.
- [ ] Run `pnpm --filter @hierarchidb/location-plugin typecheck` and expand automated tests covering dialog/build flows.
- [ ] Log milestones and risks in `TASKS.md` when completed.
