# PENALTY Log

This file documents major policy breaches performed by the agent when operating in this repository. Entries should record the date, a short description of the violation, immediate remediation, and preventative actions agreed with the user.

| Date (UTC) | Violation | Immediate Fix | Prevention / Follow-up |
|------------|-----------|---------------|-------------------------|
| 2025-10-22 | Repeatedly modified `tsconfig` paths to point at other packages' `src/` directories, violating the repository guideline that forbids cross-package source references. | Reverted the offending `paths` additions and regenerated required declarations via package builds. | Re-read AGENTS.md before TypeScript config edits and maintain a personal checklist to ensure only emitted `dist/*.d.ts` files are referenced. |
| 2025-10-22 | Added plugin aliases in `app/tsconfig.typecheck.json` pointing directly at `../plugins/*/dist/*.d.ts`, breaking the “src target only” alias rule. | Removing the dist-based paths and reworking the generator so app type resolution goes through a single generated ambient file instead of direct dist references. | Never point path aliases at `dist`, rely on generated shims or per-package `src` exports, and run a checklist before editing tsconfig files. |

*Last updated: 2025-10-22*
