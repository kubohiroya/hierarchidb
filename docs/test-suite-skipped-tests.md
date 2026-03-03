# Skipped Tests Documentation

This document tracks intentionally skipped tests and the reasons for skipping them.

## Backend Integration Tests

### @hierarchidb/bff
- **Location**: `packages/backend/bff/tests/integration.test.ts`
- **Count**: 16 tests
- **Reason**: Require external services or specific environment setup (e.g., database, authentication services)
- **Status**: Intentionally skipped
- **Review Date**: 2026-03-03

### @hierarchidb/bff E2E Tests
- **Location**: `packages/backend/bff/tests/e2e.test.ts`
- **Count**: 8 tests
- **Reason**: Require external services or specific environment setup
- **Status**: Intentionally skipped
- **Review Date**: 2026-03-03

### @hierarchidb/cors-proxy Integration Tests
- **Location**: `packages/backend/cors-proxy/tests/integration.test.ts`
- **Count**: 8 tests
- **Reason**: Require external services or specific environment setup
- **Status**: Intentionally skipped
- **Review Date**: 2026-03-03

### @hierarchidb/cors-proxy E2E Tests
- **Location**: `packages/backend/cors-proxy/tests/e2e.test.ts`
- **Count**: 7 tests
- **Reason**: Require external services or specific environment setup
- **Status**: Intentionally skipped
- **Review Date**: 2026-03-03

## SpreadsheetTabularApiDriver Tests

### @hierarchidb/build-session-ports
- **Location**: Various test files
- **Count**: 4 tests
- **Tests**:
  - Deduplicates identical uploads by content hash
  - Filters rows based on CSVFilterRule definitions
  - Tracks references and deletes row data when the last reference is removed
  - Uploads a CSV file and infers column metadata
- **Reason**: Unknown - needs investigation
- **Status**: Skipped
- **Review Date**: 2026-03-03
- **Action Required**: Investigate why these tests are skipped and either enable them or document the reason

### @hierarchidb/plugin-base
- **Location**: Various test files
- **Count**: 4 tests (same as above)
- **Reason**: Unknown - needs investigation
- **Status**: Skipped
- **Review Date**: 2026-03-03
- **Action Required**: Investigate why these tests are skipped and either enable them or document the reason

## Summary

- **Total Skipped**: ~50 tests
- **Intentionally Skipped (Backend)**: 39 tests (documented reason)
- **Needs Investigation**: 8 tests (SpreadsheetTabularApiDriver)

## Recommendations

1. **Backend Tests**: These are intentionally skipped and should remain so unless we set up proper integration test infrastructure
2. **SpreadsheetTabularApiDriver Tests**: Need to investigate why these are skipped and either:
   - Enable them if they should be running
   - Document the reason if they should remain skipped
   - Remove them if they are obsolete

## Next Review

Schedule next review for: 2026-06-03 (3 months from now)
