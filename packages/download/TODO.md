# TODO: Download Service Unification (Spreadsheet/Styler)

## Goals
- Reuse `createDownloadService` (via plugin-sdk) across spreadsheet and styler plugin APIs.
- Handle CORS proxying via optional URL transformers supplied when invoking the shared helper.
- Maintain Dexie-based chunk storage so large CSV downloads can resume.

## Investigation Tasks
1. Locate current spreadsheet download flow via `plugins/spreadsheet-plugin` and ensure no remaining dependencies on `authFetch`.
2. Repeat for styler plugin to confirm it consumes the updated CSV API driver.
3. Confirm both plugins now import the new helper from `@hierarchidb/plugin-sdk` rather than ad-hoc fetch logic.

## Design Decisions
- `downloadWithService` (plugin-sdk) accepts optional `transformUrl` / `onComplete` hooks rather than plugin-specific wrappers.
- Spreadsheet/Styler pass proxy transforms or additional hooks as needed; defaults fall back to identity behavior.
- Dexie chunk storage remains the default; alternative storages can be introduced later by extending `createDownloadService` options.

## Implementation Steps (Spreadsheet)
1. Instantiate a shared download service (`createDownloadService({ dbPrefix: 'hidb-spreadsheet' })`).
2. Replace direct fetch logic with `downloadWithService`, supplying proxy transforms if required.
3. Feed the DownloadService output into existing CSV ingestion pipeline.

## Implementation Steps (Styler)
1. Reuse the same download helper when retrieving CSV data from URLs.
2. Ensure any Styler-specific metadata generation happens in `onComplete` or after ingestion.
3. Confirm the shared helper satisfies resume/large-file requirements.

## Testing Plan
- Unit tests: mock `downloadWithService` responses to validate URL transformation and ingestion.
- Manual: download a large CSV via proxy to confirm resume works.
- Regression: run `pnpm --filter @hierarchidb/{spreadsheet-plugin,styler-plugin} typecheck` plus existing test suites.

## Documentation Updates
- Highlight the shared helper in plugin SDK docs.
- Note how to configure proxy transforms or post-download hooks for custom workflows.

## Open Questions
- Do spreadsheet/styler need to persist additional metadata (e.g., proxy provenance) alongside CSV entries?
- Should proxy transforms be configurable via runtime settings/environment, or remain code-level hooks?
