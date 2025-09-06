Title: Route plugin: searoute(-js) integration + README comparison table fix

Summary
- Integrate sea routing via searoute / searoute-js with dynamic import and graceful fallback
- Add unit-friendly hooks and flag gating (`WORKER_FEATURE_ROUTE_SEAROUTE=1` or `globalThis.FEATURE_FLAGS.ROUTE_SEAROUTE=true`)
- Fix broken “比較表（概要）” in packages/node-type/README.md and refresh content

Changes
- route-plugin
  - SearouteEngine: dynamic import('searoute' → fallback 'searoute-js'); API-shape detection (`getSeaRoute` | function | default)
  - Options mapping: `units`, `blockedAreas`→`blocked`, `avoidCanals`; speed → duration estimate (`vesselSpeedKnots` etc.)
  - Robust distance extraction: supports `properties.distance` or `properties.length` with units (‘m’|km|mi|nm); geometry fallback (haversine sum)
  - Retry path for johnx25bd/searoute-js (3rd arg units string) when error mentions `units`
  - Fallback path: great-circle straight line if feature disabled or library missing
  - package.json: add dependency `searoute-js`; mark `searoute` and `searoute-js` as external in tsup
  - scripts/smoke.mjs: minimal runtime smoke test
- Root docs
  - README: add Sea Routing section (enable flag, install steps, fallback behavior)
  - packages/node-type/route-plugin/README_NEW.md: searoute options/flag notes
  - packages/node-type/README.md: fix and update the “比較表（概要）” table (alignment, columns, network notes)

Why
- Users need maritime routes (sea lanes avoiding land) with offline-friendly option when OSRM is unavailable
- Previously SearouteEngine was a dummy haversine line; no actual sea routing
- README comparison table was broken and outdated

Flags & Defaults
- OFF by default; must enable `WORKER_FEATURE_ROUTE_SEAROUTE=1` or set `globalThis.FEATURE_FLAGS.ROUTE_SEAROUTE = true`

Testing
- Smoke: `node packages/node-type/route-plugin/scripts/smoke.mjs` prints `{ ok: true, points: N, distance: ... }`
- Note: johnx25bd/searoute-js returns `properties.length`; Engine handles both `distance` and `length`

Follow-ups
- UI wiring for `units`/`vesselSpeedKnots` where appropriate
- Add unit tests for Engine branches (dual API shapes, unit conversions, fallback)
- Optional: Add OSRM/searoute selection in batch forms; telemetry for timings

