# Implementation Plan: TreeConsole View Modes

## Overview

macOS Finder ライクなビューモードシステムを TreeConsole に追加する。型定義・atom 設計から始め、ツールバー UI → 各ビューモード → 永続化・同期の順に段階的に実装し、最後に結合する。

## Tasks

- [x] 1. Define types and extend TreeNode
  - [x] 1.1 Create view mode type definitions
    - Create `packages/ui/treeconsole/base/src/types/view-mode-types.ts`
    - Define `ViewMode`, `SortMode`, `IconPosition`, `ViewProperties`, `VIEW_MODE_DEFAULTS`
    - Export from `packages/ui/treeconsole/base/src/index.ts`
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 1.2 Extend TreeNode type with viewProperties field
    - Add optional `viewProperties?: ViewProperties` field to `TreeNode` in `packages/tree-api/src/NODE_TYPES.ts`
    - Ensure non-breaking additive change (existing consumers unaffected)
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 1.3 Write property test for ViewProperties round-trip (Property 2)
    - **Property 2: ViewProperties persistence round-trip**
    - Generate random valid `ViewProperties` objects with fast-check, verify write-then-read produces deep-equal result
    - Verify undefined `viewProperties` resolves to `VIEW_MODE_DEFAULTS`
    - **Validates: Requirements 4.6, 5.1, 5.2, 5.3, 5.4, 8.4, 9.2, 9.3**

- [x] 2. Implement jotai atom families and sync hook
  - [x] 2.1 Create view mode atom families
    - Create `packages/ui/treeconsole/base/src/state/view-mode-atoms.ts`
    - Implement `viewModeAtomFamily`, `sortModeAtomFamily`, `zoomLevelAtomFamily` using `atomFamily` keyed by `NodeId`
    - Initialize from `VIEW_MODE_DEFAULTS`
    - _Requirements: 9.1_

  - [x] 2.2 Implement atom initialization and sync hook
    - Create a sync hook that initializes atoms from `TreeNode.viewProperties` on folder navigation
    - On atom value change, write updated `viewProperties` to TreeNode via `TreeNodeUpdaterAPI`
    - On sync failure: report error, retain in-memory atom state (no silent fallback per AGENTS.md)
    - _Requirements: 9.2, 9.3, 9.4, 5.4, 5.5_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement sort comparator and zoom-to-size utilities
  - [x] 4.1 Implement sort comparator function
    - Create sort comparator utility that accepts `SortMode` and returns a comparator for `TreeNodeInUI[]`
    - Support all 8 sort modes (none returns identity / no-op)
    - _Requirements: 3.2, 4.4_

  - [x] 4.2 Write property test for sort comparator (Property 1)
    - **Property 1: Sort comparator produces correctly ordered output**
    - Generate arrays of mock `TreeNodeInUI` with random metadata, apply each non-"none" `SortMode`, verify adjacent-pair ordering invariant
    - **Validates: Requirements 3.2, 4.4**

  - [x] 4.3 Implement zoom-level-to-icon-size mapping function
    - Create pure function mapping `zoomLevel` (0–100) to icon size in pixels
    - Monotonically increasing (strictly)
    - _Requirements: 4.3_

  - [x] 4.4 Write property test for zoom-to-size monotonicity (Property 3)
    - **Property 3: Zoom level to icon size is monotonically increasing**
    - Generate pairs `(a, b)` where `0 <= a < b <= 100`, verify `size(b) > size(a)`
    - **Validates: Requirements 4.3**

- [x] 5. Implement SelectedMenu shared component
  - [x] 5.1 Create SelectedMenu component
    - Create `packages/ui/treeconsole/toolbar/src/components/toolbar/SelectedMenu.tsx`
    - Implement generic `SelectedMenu<T extends string>` with check mark on selected item, divider support
    - Add `aria-label` attributes for accessibility
    - Keyboard navigation: arrow keys, Enter, Space
    - _Requirements: 10.4_

- [x] 6. Implement toolbar selectors
  - [x] 6.1 Create SortModeSelector component
    - Create `packages/ui/treeconsole/toolbar/src/components/toolbar/SortModeSelector.tsx`
    - Render Sort icon button that opens SelectedMenu with 8 sort options + divider
    - Add `aria-label` on button and menu items
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 10.2_

  - [x] 6.2 Create ViewModeSelector component
    - Create `packages/ui/treeconsole/toolbar/src/components/toolbar/ViewModeSelector.tsx`
    - Responsive: ToggleButtonGroup (wide) / icon-button + SelectedMenu (narrow) based on configurable breakpoint
    - Icons: Apps (icon), FormatListBulleted (list), ViewColumn (column)
    - Add `aria-label` on each option; keyboard navigable ToggleButtonGroup
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 10.1, 10.3_

  - [x] 6.3 Integrate selectors into TreeConsoleToolbarContent
    - Add SortModeSelector and ViewModeSelector into the `Box sx={{ marginLeft: 'auto' }}` container, before SettingsMenu
    - Wire props: `viewMode`, `onViewModeChange`, `sortMode`, `onSortModeChange`
    - Insertion order (left to right): SortModeSelector → ViewModeSelector → SettingsMenu
    - _Requirements: 1.1, 2.1_

  - [x] 6.4 Write unit tests for toolbar selectors
    - Test SortModeSelector renders 8 options with divider in correct order
    - Test ViewModeSelector responsive switching at breakpoint
    - Test aria-label presence on all interactive elements
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 2.4, 10.1, 10.2_

- [x] 7. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement IconView
  - [x] 8.1 Create IconView component
    - Create `packages/ui/treeconsole/base/src/components/IconView.tsx`
    - Grid layout (CSS Grid auto-fill) when `sortMode !== 'none'`, sorted by sort comparator
    - Free positioning (absolute) when `sortMode === 'none'`, using `iconPosition` from `viewProperties`
    - Icon size derived from `zoomLevel` via the mapping function
    - Drag-end handler writes `{x, y}` to child TreeNode's `viewProperties.iconPosition`
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7_

  - [x] 8.2 Add zoom slider to TreeConsoleFooter
    - Extend TreeConsoleFooter to accept optional `rightSlot` prop
    - When viewMode is "icon", pass a Slider component into `rightSlot`
    - Wire slider to `zoomLevelAtomFamily`
    - _Requirements: 4.2, 4.3_

  - [x] 8.3 Write unit tests for IconView
    - Test grid layout rendering when sortMode is not "none"
    - Test free positioning rendering when sortMode is "none"
    - Test zoom slider appears only in icon mode
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 9. Implement ColumnView
  - [x] 9.1 Create useColumnView headless hook
    - Create `packages/ui/treeconsole/base/src/hooks/useColumnView.ts`
    - Implement `ColumnViewAPI` with TanStack Table-compatible shape: `getIsExpanded`, `toggleExpanded`, `getCanExpand`
    - Manage `ColumnViewState` (`expandedPath`, `selectedNodeId`)
    - Selecting node with children → append to path; selecting leaf → truncate path
    - Guard against circular references in `expandedPath`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 9.2 Write property test for column path hierarchy (Property 4)
    - **Property 4: Column path reflects selection hierarchy**
    - Generate random tree structures (depth 1–5, branching 1–4), simulate selection sequences, verify parent-child chain and truncation invariants
    - **Validates: Requirements 6.2, 6.3, 6.4**

  - [x] 9.3 Write property test for toggle self-inverse (Property 5)
    - **Property 5: Expansion toggle is self-inverse**
    - Generate random expansion states and node IDs, apply `toggleExpanded` twice, verify state equality
    - **Validates: Requirements 7.1**

  - [x] 9.4 Create ColumnView component
    - Create `packages/ui/treeconsole/base/src/components/ColumnView.tsx`
    - Use allotment for resizable pane splitting
    - Each column renders children of `expandedPath[i]`
    - Wire to `useColumnView` hook
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 10. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Wire content area switching and integration
  - [x] 11.1 Switch content area by viewMode
    - Modify TreeConsoleContent / TreeConsolePanel to render based on `viewModeAtomFamily` value:
      - `'list'` → existing TreeTableCore
      - `'icon'` → IconView
      - `'column'` → ColumnView
    - _Requirements: 3.1, 4.1, 6.1_

  - [x] 11.2 Wire sort mode to ListView
    - Apply selected `sortMode` to TreeTableCore when viewMode is "list"
    - _Requirements: 3.2_

  - [x] 11.3 Register new MUI icons and third-party deps in Vite optimizeDeps
    - Add `@mui/icons-material/Apps`, `@mui/icons-material/FormatListBulleted`, `@mui/icons-material/ViewColumn`, `@mui/icons-material/Sort`, `@mui/icons-material/Check` to `app/vite.config.ts` `optimizeDeps.include`
    - Add `allotment` to `app/package.json` dependencies and `optimizeDeps.include`
    - Run `pnpm install`
    - _Requirements: 1.4, 6.1 (AGENTS.md Vite optimizeDeps rule)_

  - [x] 11.4 Write integration tests
    - Test TreeTableCore regression: existing tests pass when viewMode is "list"
    - Test atom scoping: changing viewMode in folder A does not affect folder B
    - Test navigation round-trip: navigate away and back, verify settings restored
    - _Requirements: 3.3, 5.4, 5.5, 9.1, 9.3_

- [x] 12. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check (already available in the monorepo)
- New MUI icon imports require individual path registration in `optimizeDeps.include` (AGENTS.md rule)
- `allotment` is a new third-party dependency — must be added to `app/package.json` and `optimizeDeps.include`
