```mermaid
graph LR
  %% Core SDK layer
  PTS["@hierarchidb/plugin-types"]
  PSS["@hierarchidb/plugin-service-sdk"]
  PUI["@hierarchidb/plugin-ui-sdk"]
  PRS["@hierarchidb/plugin-runtime-services"]
  PR["@hierarchidb/plugin-registry"]

  %% Runtime consumers
  RW["@hierarchidb/runtime-worker"]
  RC["@hierarchidb/runtime-client"]

  %% Shared libraries (light nodes)
  CT["@hierarchidb/common-types"]
  CA["@hierarchidb/common-api"]
  BT["@hierarchidb/batch-types"]
  DL["@hierarchidb/download"]
  FR["@hierarchidb/feature-registry"]
  MAP["@hierarchidb/map-adapter"]
  MS["@hierarchidb/map-source"]
  CMP["@hierarchidb/compute"]
  IE["@hierarchidb/import-export"]
  TS["@hierarchidb/tabular-source"]
  TSX["@hierarchidb/tabular-source-xlsx"]
  TST["@hierarchidb/tabular-store"]
  TAG["@hierarchidb/tag"]
  UTIL["@hierarchidb/util"]
  AUTH["@hierarchidb/auth-recovery"]

  %% Edges from core SDK packages
  PTS --> PSS
  PTS --> CT
  PTS --> DL

  PSS --> CT
  PSS --> CA
  PSS --> BT
  PSS --> DL

  PUI --> PSS
  PUI --> CT
  PUI --> CA
  PUI --> BT
  PUI --> DL

  PRS --> PSS
  PRS --> CT
  PRS --> DL

  %% Runtime dependencies
  RW --> PR
  RW --> PTS
  RW --> CA
  RW --> CT
  RW --> FR
  RW --> MAP
  RW --> MS
  RW --> CMP
  RW --> IE
  RW --> DL
  RW --> TS
  RW --> TSX
  RW --> TST
  RW --> TAG
  RW --> UTIL
  RW --> AUTH

  RC --> RW
  RC --> CA
  RC --> CT
```
