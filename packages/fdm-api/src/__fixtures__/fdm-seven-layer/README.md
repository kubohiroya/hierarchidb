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

The first migration pass uses these directories as stable anchors for later package-level tests.
