# Route Plugin Follow-up Plan

Route plugin is the most complete reference for the desired UX. Ensure it stays aligned after shape/location refactors and capture outstanding cleanup.

- [ ] Confirm multi-step dialog (basic info, selection, processing) still matches current spec and worker contracts.
- [ ] Double-check build progress UI (live progress, table preview, recovery) and remove lingering mocks or unused adapters.
- [ ] Align `tsconfig` so UI/service code type-check together; prune redundant path aliases.
- [ ] Harden unit/integration tests around dialog validation and build orchestration.
- [ ] Document maintenance checklist in the linked GitHub Issue to keep route as canonical reference.
