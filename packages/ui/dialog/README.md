# @hierarchidb/ui-dialog

Shared dialog components for HierarchiDB plugin/runtime UIs: headless multi-step shell plus common dialogs/actions/titles.

## Directory layout
```
components/   CommonDialog, Actions/Title, AutoHideFullScreenDialog, UnsavedChangesDialog
headless/     MultiStepDialog shell (Header/Footer/Content/Frame), types and helpers
hooks/        useDialogContext, useDialogInteractionGuards
types/        MultiStepDialog types, stepper dialog types
utils/        dialogSurfaceColor, frame helpers
index.ts      Public exports
```

## Key exports
- Headless shell: `MultiStepDialog`, `MultiStepDialogHeader/Footer/Content`, `MultiStepDialogFrame`, `frameHelpers`.
- Common components: `CommonDialog`, `CommonDialogActions`, `CommonDialogTitle`, `AutoHideFullScreenDialog`, `UnsavedChangesDialog`.
- Hooks: `useDialogContext`, `useDialogInteractionGuards`.
- Types: `MultiStepDialogProps`, `StepperDialogStep`, stepper dialog types.

## Consumers / usage
- `@hierarchidb/plugin-ui-host` uses the headless shell to wrap plugin steps.
- Feature plugins reuse `CommonDialog*` pieces for simple dialogs; app-level dialogs can layer styling on top.

## Notes
- Headless components are MUI-based but keep layout minimal; appearance is provided by host/app themes.
