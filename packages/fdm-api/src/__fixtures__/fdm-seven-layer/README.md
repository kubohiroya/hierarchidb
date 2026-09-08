# FDM seven-layer fixtures

This directory is the shared fixture root for the FDM seven-layer migration.

Layer directories:

- `l0-timeline`: timeline/checkpoint compatibility cases.
- `l1-parameter-set`: parameter set/profile compatibility cases.
- `l2-range-snapshot`: range snapshot and result reference cases.
- `l3-run-job`: run/job/task bridge cases.
- `l4-workflow`: workflow projection cases.
- `l5-ruleset`: ruleset and governance cases.
- `l6-space`: FDM space catalog and lifecycle cases.

Fixture naming rules:

- positive fixtures use the current canonical seven-layer name where the contract is ready.
- compatibility fixtures name the legacy alias that is still accepted.
- negative fixtures start with `negative-` and must assert rejection rather than silent defaulting.
- gated upstream behavior should be represented as `availability: "unavailable"` or `unsupported`, not inferred locally.

Current Phase B1 coverage:

- L0: `timeline` / legacy `checkpoint` compatibility and conflict rejection.
- L1: `parameterSet` / legacy `profile` saved-node normalization.
- L2: `resultRef` projection into canonical snapshot references.
- L3: runtime-event bridge payloads and forbidden credential-key rejection.
- L4: workflow projection acceptance and unknown status rejection.
- L5: ruleset governance projection acceptance.
- L6: current space catalog metadata with explicit unavailable or unscoped provenance.
