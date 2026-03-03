# Test Suite Failure Analysis

## Summary
Based on `pnpm test` execution, the following test failures and skips were identified:

## Failed Test Categories

### 1. AuthService Tests (Multiple packages)
**Status**: 9 failures per package (timeout + assertion failures)
**Affected packages**: 
- @hierarchidb/ui-worker-provider
- @hierarchidb/core-types
- @hierarchidb/gis-sdk
- @hierarchidb/build-session-ports
- @hierarchidb/plugin-base
- @hierarchidb/vectortile-orchestrator

**Failures**:
- Popup Authentication Flow: timeout (5000ms)
- URL Building: missing 'atoms=' parameter
- Error Handling: spy not called
- PKCE: missing 'code_challenge=' parameter
- nonce: timeout (5000ms)
- Multiple provider: timeout (5000ms)
- Network retry: timeout (5000ms)
- Cleanup: spy not called

**Root cause**: Tests appear to be outdated or implementation changed

### 2. MultiAuthContext Tests (Multiple packages)
**Status**: 22 failures per package
**Affected packages**: Same as AuthService

**Failures**: All tests failing with similar patterns
**Root cause**: Context provider tests not matching current implementation

### 3. LinkButton Component Tests
**Status**: 3 failures per package
**Affected packages**: 
- @hierarchidb/ui-worker-provider
- @hierarchidb/core-types
- @hierarchidb/build-session-ports
- @hierarchidb/vectortile-orchestrator
- @hierarchidb/plugin-base

**Failures**:
- Confirmation Dialog tests timing out (1173-1530ms)
- useLinkButton Hook error handling

### 4. Shape Plugin Tests
**Status**: 3 failures
**Package**: @hierarchidb/shape-plugin

**Failures**:
- useShapeCountrySelectionStep cache behavior (3 tests, all timeout at 3000ms)

**Root cause**: Hook tests timing out, likely async operation not completing

### 5. Resolver Plugin Tests
**Status**: 1 failure
**Package**: @hierarchidb/resolver-plugin

**Failure**:
- Performance Optimization: compilation time 221ms > 200ms threshold

**Root cause**: Performance regression or unrealistic threshold

### 6. Import/Export Tests
**Status**: 2 failures
**Package**: @hierarchidb/import-export

**Failures**:
- Import Template depth assignment: "The URL must be of scheme file"
- Name conflicts: auto-rename not working as expected

### 7. Folder Plugin Tests
**Status**: Build failure
**Package**: @hierarchidb/folder-plugin

**Failure**:
- Failed to resolve import "~/hooks/useDialogContext" from AbstractDialog.tsx

**Root cause**: Path alias resolution issue in test environment

## Skipped Tests

### Backend Integration/E2E Tests
**Status**: Intentionally skipped (24 tests)
**Packages**:
- @hierarchidb/bff (16 integration + 8 e2e)
- @hierarchidb/cors-proxy (8 integration + 7 e2e)

**Reason**: Likely require external services or specific environment setup

### SpreadsheetTabularApiDriver Tests
**Status**: 4 tests skipped
**Packages**: @hierarchidb/build-session-ports, @hierarchidb/plugin-base

**Tests**:
- Deduplicates identical uploads by content hash
- Filters rows based on CSVFilterRule definitions
- Tracks references and deletes row data
- Uploads a CSV file and infers column metadata

## Test Execution Issues

### Memory Exhaustion
**Status**: Not observed in this run (previous issue)
**Note**: Full test suite completed without memory crash

## Recommendations

### High Priority
1. **AuthService + MultiAuthContext**: 31 failures × 6 packages = ~186 failures
   - Review implementation changes
   - Update test expectations or fix implementation
   - Consider if these tests are still relevant

2. **Folder Plugin**: Build failure blocking all tests
   - Fix path alias resolution in vitest config
   - Ensure `~/hooks/useDialogContext` resolves correctly

3. **Shape Plugin**: Timeout issues
   - Investigate async operations in useShapeCountrySelectionStep
   - Increase timeout or fix hanging operations

### Medium Priority
4. **LinkButton**: 3 failures × 5 packages = ~15 failures
   - Review confirmation dialog implementation
   - Update test expectations

5. **Import/Export**: 2 failures
   - Fix file URL scheme handling
   - Fix auto-rename logic

### Low Priority
6. **Resolver Plugin**: Performance test
   - Review if 200ms threshold is realistic
   - Optimize compilation or adjust threshold

7. **Skipped Tests**: Review if they should be enabled
   - Backend integration tests
   - SpreadsheetTabularApiDriver tests

## Statistics
- **Total Failed**: ~220+ test cases
- **Total Skipped**: ~50+ test cases
- **Packages with Failures**: 10+
- **Critical Blockers**: 1 (folder-plugin build failure)
