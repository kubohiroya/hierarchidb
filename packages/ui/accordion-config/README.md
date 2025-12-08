# @hierarchidb/ui-accordion-config

Accordion components and presets for settings/workflow panels.

## Directory layout
```
BaseAccordion.tsx      Core accordion
StyledAccordion.tsx    Variants (outlined/filled/elevated)
GroupedAccordion.tsx   Group/exclusive expansion
WorkflowAccordion.tsx  Step/status-focused preset
SettingsAccordion.tsx  Config panels with actions
CollapsibleSection.tsx Lightweight collapsible block
hooks/useAccordionState.ts  State helper
index.ts               Public exports
```

## Key features
- Variants/presets with color schemes, gradients, elevation.
- Grouped/exclusive expansion; default expanded keys; callbacks.
- Workflow/Settings presets for multi-step and config UIs.

## Usage (minimal)
```tsx
<StyledAccordion variant="outlined" title="Settings">
  Content
</StyledAccordion>
```
