# Requirements Document

## Introduction

macOS Finder ライクなビューモードシステムを treeconsole UI に追加する。ツールバーにビューモード切替（Icon / List / Column）とソートモード切替を配置し、既存の treetable を List ビューとして位置づけつつ、新たに Icon ビューと Column ビューを実装する。各ビューモードの設定（ズームレベル、アイコン座標など）は TreeNode プロパティとして永続化する。

## Glossary

- **TreeConsole**: ツリー構造データを表示・操作する UI コンポーネント群（toolbar / content / footer / treetable を含む）
- **Toolbar**: TreeConsole 上部のアクションバー。検索、操作ボタン、設定メニューを含む
- **Footer**: TreeConsole 下部のステータスバー。選択数・ノード数などの統計情報を表示する
- **ViewMode**: TreeConsole のコンテンツ表示形式。"icon" / "list" / "column" の 3 種類
- **SortMode**: TreeConsole のノード並び順。"none" / "name" / "type" / "lastOpened" / "created" / "modified" / "size" / "tag" の 8 種類
- **ViewModeSelector**: ビューモードを切り替える UI コントロール。アイコンボタン + SelectedMenu、またはビューポート幅が十分な場合は ToggleButtonGroup として表示
- **SortModeSelector**: ソートモードを切り替える UI コントロール。Sort アイコンボタン + SelectedMenu
- **SelectedMenu**: MUI Menu ベースの選択メニュー。選択中の項目にチェックマークを表示する
- **ToggleButtonGroup**: MUI ToggleButtonGroup。排他選択のボタングループ
- **IconView**: アイコン表示モード。ノードをアイコン＋ラベルのグリッド/自由配置で表示する
- **ListView**: リスト表示モード。既存の TreeTableCore（TanStack Table ベース）による表形式表示
- **ColumnView**: カラム表示モード。Smalltalk クラスブラウザ風の階層カラム表示。allotment によるリサイズ可能なペイン分割
- **TreeNode**: ツリー構造の各ノードを表すデータ型（`@hierarchidb/tree-api` で定義）
- **ZoomLevel**: IconView でのアイコンサイズを制御する数値（0〜100 のスライダー値）
- **IconPosition**: IconView + SortMode "none" 時にユーザーがドラッグで配置したアイコンの x,y 座標
- **Allotment**: React 用のリサイズ可能ペイン分割ライブラリ
- **TanStackTable**: TanStack Table（旧 React Table）。TreeTableCore の基盤ライブラリ
- **HeadlessAPI**: UI 実装を持たないロジック層 API。ColumnView の展開状態管理を TanStack Table の expandable API と互換にする

## Requirements

### Requirement 1: View Mode Selector in Toolbar

**User Story:** As a user, I want to switch between Icon, List, and Column view modes from the toolbar, so that I can choose the most suitable way to browse tree nodes.

#### Acceptance Criteria

1. THE Toolbar SHALL display a ViewModeSelector to the left of the SettingsMenu button in the right-side area of the toolbar
2. WHEN the viewport width is below a configurable breakpoint, THE ViewModeSelector SHALL render as an icon button showing the currently selected mode's icon that opens a SelectedMenu on click
3. WHEN the viewport width is at or above the configurable breakpoint, THE ViewModeSelector SHALL render as a ToggleButtonGroup with three options
4. THE ViewModeSelector SHALL provide three options: "Icon" (Apps icon), "List" (FormatListBulleted icon), "Column" (ViewColumn icon)
5. THE ViewModeSelector SHALL default to "list" when no persisted value exists
6. WHEN the user selects a view mode, THE ViewModeSelector SHALL emit the selected value through a callback and update the displayed icon or toggle state

### Requirement 2: Sort Mode Selector in Toolbar

**User Story:** As a user, I want to select a sort mode from the toolbar, so that I can control the ordering of tree nodes in the current view.

#### Acceptance Criteria

1. THE Toolbar SHALL display a SortModeSelector icon button (Sort icon) to the left of the ViewModeSelector in the right-side area of the toolbar
2. WHEN the user clicks the SortModeSelector button, THE SortModeSelector SHALL open a SelectedMenu
3. THE SortModeSelector SelectedMenu SHALL display the following items in order: "None", (divider), "Name", "Type", "Last Opened", "Created", "Modified", "Size", "Tag"
4. THE SortModeSelector SelectedMenu SHALL indicate the currently active sort mode with a visual marker (check icon)
5. WHEN the user selects a sort mode, THE SortModeSelector SHALL emit the selected value through a callback and close the menu

### Requirement 3: List View Mode (Existing TreeTable)

**User Story:** As a user, I want the existing tree table to serve as the List view mode, so that I can continue using the familiar tabular view.

#### Acceptance Criteria

1. WHEN ViewMode is "list", THE TreeConsole SHALL render the existing TreeTableCore component as the content area
2. WHEN ViewMode is "list", THE TreeConsole SHALL apply the selected SortMode to the displayed nodes
3. THE ListView SHALL preserve all existing TreeTableCore functionality including selection, expansion, drag-and-drop, inline editing, and context menus

### Requirement 4: Icon View Mode

**User Story:** As a user, I want an Icon view that displays nodes as draggable icons with labels, so that I can visually organize and browse nodes like in macOS Finder's icon view.

#### Acceptance Criteria

1. WHEN ViewMode is "icon", THE TreeConsole SHALL render an IconView component that displays each child node as an icon with a label beneath it
2. WHEN ViewMode is "icon", THE Footer SHALL display a zoom Slider on the right side to control the ZoomLevel of icons
3. WHEN the user adjusts the zoom Slider, THE IconView SHALL scale the icon size according to the ZoomLevel value
4. WHEN ViewMode is "icon" AND SortMode is not "none", THE IconView SHALL arrange icons in a grid layout sorted by the selected SortMode
5. WHEN ViewMode is "icon" AND SortMode is "none", THE IconView SHALL allow the user to freely position icons by dragging them
6. WHEN the user drags an icon to a new position in free-positioning mode, THE IconView SHALL persist the x,y coordinates as IconPosition properties on the corresponding TreeNode
7. WHEN ViewMode is "icon" AND SortMode changes from "none" to a named sort, THE IconView SHALL transition from free positioning to sorted grid layout

### Requirement 5: Icon View Persistence

**User Story:** As a user, I want my icon view settings (zoom level and icon positions) to be saved, so that they are restored when I return to the same folder.

#### Acceptance Criteria

1. THE TreeConsole SHALL persist the selected ViewMode as a property on the parent TreeNode (the folder being viewed)
2. THE TreeConsole SHALL persist the selected ZoomLevel as a property on the parent TreeNode
3. WHEN ViewMode is "icon" AND SortMode is "none", THE TreeConsole SHALL persist each child node's IconPosition (x,y coordinates) as a property on that child TreeNode
4. WHEN the user navigates to a folder that has persisted ViewMode and ZoomLevel, THE TreeConsole SHALL restore those settings from the TreeNode properties
5. WHEN the user navigates to a folder that has no persisted ViewMode, THE TreeConsole SHALL use "list" as the default ViewMode

### Requirement 6: Column View Mode

**User Story:** As a user, I want a Column view that shows the tree hierarchy as side-by-side resizable columns (like Smalltalk's class browser or macOS Finder's column view), so that I can navigate deep hierarchies efficiently.

#### Acceptance Criteria

1. WHEN ViewMode is "column", THE TreeConsole SHALL render a ColumnView component using allotment for resizable pane splitting
2. THE ColumnView SHALL display each hierarchy level as a separate vertical column, where selecting a node in one column reveals its children in the next column to the right
3. WHEN the user selects a node that has children, THE ColumnView SHALL add a new column to the right showing the children of the selected node
4. WHEN the user selects a node that has no children, THE ColumnView SHALL remove any columns to the right of the current column beyond the selected node's level
5. THE ColumnView SHALL allow the user to resize column widths by dragging the allotment splitter handles

### Requirement 7: Column View Headless API

**User Story:** As a developer, I want the Column view to expose a headless API compatible with TanStack Table's expandable API, so that I can integrate it with existing table-based logic and plugins.

#### Acceptance Criteria

1. THE ColumnView SHALL expose a headless API that provides expansion state management (expanded node IDs, toggle expansion, expand/collapse operations)
2. THE ColumnView headless API SHALL use the same data shape as TanStack Table's expandable row model (getIsExpanded, toggleExpanded, getCanExpand)
3. THE ColumnView headless API SHALL accept the same TreeNodeInUI data type used by the existing TreeTableCore
4. THE ColumnView headless API SHALL emit selection and expansion state changes through callbacks compatible with the existing TreeTableController interface

### Requirement 8: TreeNode Type Extension for View Properties

**User Story:** As a developer, I want the TreeNode type to support view-related properties, so that view mode settings and icon positions can be persisted alongside node data.

#### Acceptance Criteria

1. THE TreeNode type SHALL include an optional `viewProperties` field for storing view-related settings
2. THE `viewProperties` field SHALL support `viewMode` (ViewMode enum), `zoomLevel` (number), and `sortMode` (SortMode enum) for folder nodes
3. THE `viewProperties` field SHALL support `iconPosition` ({ x: number; y: number }) for child nodes in IconView free-positioning mode
4. IF a TreeNode has no `viewProperties` field, THEN THE TreeConsole SHALL use default values (viewMode: "list", zoomLevel: 50, sortMode: "none", iconPosition: undefined)

### Requirement 9: View Mode State Management

**User Story:** As a developer, I want view mode state to be managed through jotai atoms, so that it integrates with the existing SSOT state tree and enables reactive updates across components.

#### Acceptance Criteria

1. THE TreeConsole SHALL manage ViewMode, SortMode, and ZoomLevel state through jotai atoms scoped to the current folder's NodeId
2. WHEN a view-related atom value changes, THE TreeConsole SHALL synchronize the new value to the corresponding TreeNode's `viewProperties` field
3. WHEN the user navigates to a different folder, THE TreeConsole SHALL initialize the view-related atoms from the target folder's TreeNode `viewProperties`
4. IF synchronization to TreeNode persistence fails, THEN THE TreeConsole SHALL report the error and retain the in-memory atom state without silently falling back

### Requirement 10: Accessibility for View Mode Controls

**User Story:** As a user relying on assistive technology, I want the view mode and sort mode controls to be accessible, so that I can operate them with keyboard and screen readers.

#### Acceptance Criteria

1. THE ViewModeSelector SHALL provide aria-label attributes describing each view mode option
2. THE SortModeSelector SHALL provide aria-label attributes describing the sort button and each menu item
3. WHEN the ViewModeSelector renders as a ToggleButtonGroup, THE ToggleButtonGroup SHALL be keyboard navigable using arrow keys
4. WHEN the ViewModeSelector or SortModeSelector renders as a SelectedMenu, THE SelectedMenu SHALL be navigable using arrow keys and selectable using Enter or Space
