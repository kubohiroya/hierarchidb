// Core components
export { BaseAccordion } from './components/BaseAccordion';
export type { BaseAccordionProps } from './components/BaseAccordion';

export { StyledAccordion } from './components/StyledAccordion';
export type { StyledAccordionProps, AccordionVariant, AccordionColorScheme } from './components/StyledAccordion';

export { GroupedAccordion } from './components/GroupedAccordion';
export type { GroupedAccordionProps, AccordionGroupItem } from './components/GroupedAccordion';

export { CollapsibleSection } from './components/CollapsibleSection';
export type { CollapsibleSectionProps } from './components/CollapsibleSection';

// Hooks
export { useAccordionState } from './hooks/useAccordionState';
export type { AccordionState, UseAccordionStateOptions } from './hooks/useAccordionState';

// Preset components
export { WorkflowAccordion, SettingsAccordion } from './presets';
export type { WorkflowAccordionProps, WorkflowStep, SettingsAccordionProps } from './presets';

// Legacy components (for backward compatibility - will be deprecated)
export { ConfigAccordion } from './components/ConfigAccordion';
export type { ConfigAccordionProps } from './components/ConfigAccordion';

export { PhaseConfigAccordion } from './components/PhaseConfigAccordion';
export type { PhaseConfigAccordionProps } from './components/PhaseConfigAccordion';