# Info components

Reusable info/help UI parts: modal, panels, content blocks, and license display.

## Directory layout
```
InfoDialog.tsx      Modal wrapper
InfoContent.tsx     Title/description/logo/details block
InfoPanel.tsx       Panel layout with actions
LicenseInfo.tsx     License list/search/sort
index.ts            Public exports
```

## Key exports
- `InfoDialog` — modal container; pairs with `InfoContent` inside.
- `InfoContent` — logo/title/description/details/links.
- `InfoPanel` — panel with optional info/help actions.
- `LicenseInfo` — renders license JSON with search/sort/expand.

## Consumers / usage
- App “About” dialogs and info panels; license view in settings/help pages.

## Notes
- Accepts custom React nodes for logo/actions; style via MUI theme props.
