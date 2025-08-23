# HierarchiDB Development Reports - Index

## Document Structure

### Technical Specifications & Architecture
- **[technical-architecture-specification.md](./technical-architecture-specification.md)** - Detailed Technical Architecture Specification
- **[architecture/](./architecture/)** - Architecture-related documents
  - node-type-definition-migration.md
  - registry-consolidation-plan.md
  - duplicate-files-consolidation.md

### Implementation & Development Results
- **[implementation-analysis-report.md](./implementation-analysis-report.md)** - Implementation Analysis Report
- **[implementation-completion-report.md](./implementation-completion-report.md)** - Implementation Completion Report
- **[implementation-migration-spec.md](./implementation-migration-spec.md)** - Implementation Migration Specification
- **[improvement-action-plan.md](./improvement-action-plan.md)** - Improvement Action Plan

### Plugin Development
- **[development/](./development/)** - Development Guides
  - plugin-development-guide.md
  - plugin-testing-guide.md
  - naming-conventions.md
  - common-validation-patterns.md

### Plugin Specifications
- **[basemap/](./basemap/)** - BaseMap Plugin
- **[shape/](./shape/)** - Shape Plugin  
- **[stylemap/](./stylemap/)** - StyleMap Plugin
- **[project/](./project/)** - Project Plugin
- **[spreadsheet/](./spreadsheet/)** - Spreadsheet Plugin

### Design & Specifications
- **[design/](./design/)** - Design Documents
  - treeconsole-migration/
  - plugin-shapes/
  - plugin-stylemap/
- **[spec/](./spec/)** - Specifications & Requirements
  - plugin-*-requirements.md
  - plugin-*-acceptance-criteria.md
  - worker-implementation-*.md

### Implementation Records & Tasks
- **[implements/](./implements/)** - Implementation Records
  - plugin-shapes/
  - copy-paste/
  - tree-controller/
  - undo-redo/
  - hierarchical-plugin-routing/
  - refactoring-*/
  - task-*/
- **[tasks/](./tasks/)** - Development Tasks

### Migration & Refactoring
- **[migration/](./migration/)** - Migration Plans
  - basemap-plugin-migration.md
  - plugin-migration.md
  - react19-es2022-migration.md
  - working-copy-migration-plan.md
- **[import-export-migration-plan.md](./import-export-migration-plan.md)** - Import/Export Migration

### Build & Development Environment
- **[build-system-strategy.md](./build-system-strategy.md)** - Build System Strategy
- **[biome-migration-assessment.md](./biome-migration-assessment.md)** - Biome Migration Assessment
- **[package-export-guidelines.md](./package-export-guidelines.md)** - Package Export Guidelines

### Analysis & Reports
- **[dialog-implementation-analysis.md](./dialog-implementation-analysis.md)** - Dialog Implementation Analysis
- **[ui-plugin-architecture.md](./ui-plugin-architecture.md)** - UI Plugin Architecture
- **[ui-dialog-migration-summary.md](./ui-dialog-migration-summary.md)** - UI Dialog Migration Summary
- **[plugin-database-independence.md](./plugin-database-independence.md)** - Plugin Database Independence
- **[plugin-metadata-entity-hints.md](./plugin-metadata-entity-hints.md)** - Plugin Metadata & Entity Hints

### Reverse Engineering
- **[reverse/](./reverse/)** - Reverse Engineering Documents
  - basemap-requirements.md
  - basemap-implementation-comparison.md

### Licenses & External Dependencies
- **[licenses.json](./licenses.json)** - License Information
- **[external-licenses.json](./external-licenses.json)** - External Licenses
- **[ui-duplication-report.json](./ui-duplication-report.json)** - UI Duplication Report

### Others
- **[inline/](./inline/)** - Inline Editing Related
- **[X-dialog.md](./X-dialog.md)** - Dialog Implementation Notes

## Document Usage Guide

### For New Developers
1. [technical-architecture-specification.md](./technical-architecture-specification.md) - Understanding the overall system
2. [development/plugin-development-guide.md](./development/plugin-development-guide.md) - Plugin development introduction
3. [architecture/](./architecture/) - Architecture details

### For Plugin Developers
1. Target plugin folders (basemap/, shape/, stylemap/, project/, spreadsheet/)
2. [spec/](./spec/) - Requirements & specifications review
3. [development/](./development/) - Development guidelines

### For Architects & Leads
1. [implementation-analysis-report.md](./implementation-analysis-report.md) - Implementation status overview
2. [improvement-action-plan.md](./improvement-action-plan.md) - Improvement plans
3. [migration/](./migration/) - Migration strategies

## Related Resources

- **[../MANUAL/](../MANUAL/)** - End-user Manual
- **[../../CLAUDE.md](../../CLAUDE.md)** - Project Development Configuration
- **[./deprecated/](../deprecated/)** - Deprecated Documents