Title: Docs: Tabular Preview flags, indexing, and UI usage (follow-up)

Summary
- Document Tabular Preview (flags, capabilities, and intended use) in the root README.
- Add README for @hierarchidb/tabular-store explaining concepts and APIs.

Changes
- README.md: Tabular Preview section (flags, features, Import/Export note).
- packages/feature/tabular-store/README.md: Writer/Query/Index overview with usage snippets.

Why
- Consolidate how to enable and use the feature across location/shape/route.
- Clarify that CSV/JSON dump is not needed and Import/Export remains the canonical path for full serialization.

Risk / Rollback
- Low risk; docs only. Can be reverted by removing two files’ diffs.

