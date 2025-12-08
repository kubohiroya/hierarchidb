# @hierarchidb/runtime-search-result-window

Search result window with table selection + map highlight, packaged as a floating window.

## Directory layout
```
components/      SearchResultWindow, SearchResultTable, MapHighlightProvider
atoms/           Jotai atoms for selection/highlight
hooks/           useMultiSelection, useMapHighlight
index.ts         Public exports
```

## Key features
- Table view with single/range/toggle selection; selection state via Jotai.
- Map highlight state (matched/selected/focused nodes) for MapLibre integration.
- Floating window wrapper for draggable overlay.

## Consumers / usage
- Used in tree/search flows to display results and drive map focus/highlight.
- Accepts callbacks for selection change and map focus; wrap in Jotai Provider when embedding.

## Notes
- Selection atoms drive all UI; map highlight atoms coordinate map updates.
