# UI Package Refactoring Requirements

## Overview
Refactor duplicate code across ui-* packages to improve maintainability and reduce code duplication.

## Requirements

### 1. Consolidate Logger Utilities to ui-core
**Current State:**
- `devLog`, `devError`, `devWarn` functions exist in both `ui-file/src/utils/logger.ts` and `ui-monitoring/src/utils/logger.ts`
- Identical implementation with only different prefixes ([File] vs [Monitor])

**Target State:**
- Single implementation in `ui-core/src/utils/logger.ts`
- Configurable prefix parameter

**Test Requirements:**
```typescript
// ui-core/src/utils/logger.test.ts
describe('Logger utilities', () => {
  it('should log with custom prefix in development mode', () => {
    const logger = createLogger('TestPrefix');
    // Verify console.log is called with '[TestPrefix]' prefix
  });
  
  it('should not log in production mode', () => {
    // Set NODE_ENV to 'production'
    // Verify console methods are not called
  });
});
```

**Acceptance Criteria:**
- [ ] Logger utilities moved to ui-core
- [ ] ui-file and ui-monitoring import from ui-core
- [ ] All existing functionality preserved
- [ ] Tests pass for all affected packages

### 2. Consolidate Theme Utilities
**Current State:**
- `getStoredThemeMode`, `getSystemTheme` duplicated in:
  - `ui-core/src/components/ThemedLoadingScreen.tsx`
  - `ui-theme/src/utils/storage.ts`

**Target State:**
- Single source of truth in `ui-theme` package
- ui-core imports from ui-theme

**Test Requirements:**
```typescript
// ui-theme/src/utils/storage.test.ts
describe('Theme storage utilities', () => {
  it('should retrieve stored theme mode from localStorage', () => {
    localStorage.setItem('theme-mode', 'dark');
    expect(getStoredThemeMode()).toBe('dark');
  });
  
  it('should return system theme when no stored preference', () => {
    expect(getStoredThemeMode()).toBe('system');
  });
  
  it('should detect system dark mode preference', () => {
    // Mock window.matchMedia
    expect(getSystemTheme()).toBe('dark');
  });
});
```

**Acceptance Criteria:**
- [ ] Theme utilities exist only in ui-theme
- [ ] ui-core imports from ui-theme
- [ ] ThemedLoadingScreen uses ui-theme utilities
- [ ] No functional regression

### 3. Consolidate Navigation Components
**Current State:**
- `MenuListItemLinkButton` exists in both ui-navigation and ui-routing (97.2% similar)
- `NavLinkMenu` exists in both packages (74.4% similar)

**Target State:**
- Components exist only in ui-navigation
- ui-routing imports from ui-navigation if needed

**Test Requirements:**
```typescript
// ui-navigation/src/components/MenuListItemButton/MenuListItemLinkButton.test.tsx
describe('MenuListItemLinkButton', () => {
  it('should render link with correct href', () => {
    render(<MenuListItemLinkButton href="/test" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/test');
  });
  
  it('should apply active styles when selected', () => {
    // Test active state styling
  });
});
```

**Acceptance Criteria:**
- [ ] Components exist only in ui-navigation
- [ ] ui-routing functionality maintained through imports
- [ ] All navigation tests pass
- [ ] No breaking changes in app package

### 4. Consolidate ThemedLoadingScreen Component
**Current State:**
- Exists in both ui-core and ui-layout
- ui-layout version uses ui-theme utilities
- ui-core version has embedded theme utilities

**Target State:**
- Single implementation in ui-core
- Uses ui-theme for theme utilities
- ui-layout re-exports from ui-core if needed

**Test Requirements:**
```typescript
// ui-core/src/components/ThemedLoadingScreen.test.tsx
describe('ThemedLoadingScreen', () => {
  it('should render linear progress by default', () => {
    render(<ThemedLoadingScreen />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
  
  it('should render circular progress when specified', () => {
    render(<ThemedLoadingScreen variant="circular" />);
    // Verify circular progress is rendered
  });
  
  it('should apply correct theme colors', () => {
    // Test both light and dark themes
  });
});
```

**Acceptance Criteria:**
- [ ] Single implementation in ui-core
- [ ] Uses ui-theme utilities
- [ ] ui-layout imports/re-exports from ui-core
- [ ] SSR hydration issues resolved

### 5. Consolidate UserAvatar Component
**Current State:**
- Exists in ui-auth and ui-core (89.3% similar)
- Different import paths for utilities

**Target State:**
- Single implementation in ui-core
- ui-auth imports from ui-core

**Test Requirements:**
```typescript
// ui-core/src/components/UserAvatar/UserAvatar.test.tsx
describe('UserAvatar', () => {
  it('should display user initials when no image', () => {
    render(<UserAvatar name="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });
  
  it('should display user image when provided', () => {
    render(<UserAvatar name="John Doe" imageUrl="/avatar.jpg" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/avatar.jpg');
  });
});
```

**Acceptance Criteria:**
- [ ] Single implementation in ui-core
- [ ] ui-auth imports from ui-core
- [ ] All avatar functionality preserved
- [ ] Google image variant support maintained

### 6. Fix MemoryUsageChart Duplication
**Current State:**
- MemoryUsageChart exists in two locations within ui-monitoring:
  - `src/components/MemoryUsageBar/MemoryUsageChart.tsx`
  - `src/components/MemoryUsageChart/MemoryUsageChart.tsx`

**Target State:**
- Single implementation in `src/components/MemoryUsageChart/`
- MemoryUsageBar imports from the single location

**Test Requirements:**
```typescript
// ui-monitoring/src/components/MemoryUsageChart/MemoryUsageChart.test.tsx
describe('MemoryUsageChart', () => {
  it('should render memory usage as percentage', () => {
    render(<MemoryUsageChart used={50} total={100} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
  
  it('should update chart on memory change', () => {
    // Test chart updates with new data
  });
});
```

**Acceptance Criteria:**
- [ ] Single MemoryUsageChart implementation
- [ ] MemoryUsageBar correctly imports the component
- [ ] No functionality loss
- [ ] Export paths maintained for backward compatibility

## Implementation Order
1. Logger utilities consolidation (simplest, no breaking changes)
2. Theme utilities consolidation (affects ThemedLoadingScreen)
3. ThemedLoadingScreen consolidation (depends on theme utils)
4. UserAvatar consolidation
5. Navigation components consolidation
6. MemoryUsageChart internal cleanup

## Success Metrics
- Code duplication reduced by ~15-20%
- All tests pass
- No breaking changes in app package
- Build size reduced
- TypeScript compilation successful
- No runtime errors in development or production

## Rollback Plan
- Each consolidation is a separate commit
- Can revert individual changes if issues arise
- Keep original files until all imports are updated