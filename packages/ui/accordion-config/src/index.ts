// Core components
export { BaseAccordion } from './components/BaseAccordion.js';
export type { BaseAccordionProps } from './components/BaseAccordion.js';

export { StyledAccordion } from './components/StyledAccordion.js';
export type { StyledAccordionProps, AccordionVariant, AccordionColorScheme } from './components/StyledAccordion.js';

export { GroupedAccordion } from './components/GroupedAccordion.js';
export type { GroupedAccordionProps, AccordionGroupItem } from './components/GroupedAccordion.js';

export { CollapsibleSection } from './components/CollapsibleSection.js';
export type { CollapsibleSectionProps } from './components/CollapsibleSection.js';

// Hooks
export { useAccordionState } from './hooks/useAccordionState.js';
export type { AccordionState, UseAccordionStateOptions } from './hooks/useAccordionState.js';

// Preset components
export { WorkflowAccordion, SettingsAccordion } from './presets/index.js';
export type { WorkflowAccordionProps, WorkflowStep, SettingsAccordionProps } from './presets/index.js';

// Legacy components (for backward compatibility - will be deprecated)
export { ConfigAccordion } from './components/ConfigAccordion.js';
export type { ConfigAccordionProps } from './components/ConfigAccordion.js';

export { PhaseConfigAccordion } from './components/PhaseConfigAccordion.js';
export type { PhaseConfigAccordionProps } from './components/PhaseConfigAccordion.js';


// Build config components
export { BuildConfigSectionTitle } from './build-config/BuildConfigSectionTitle.js';
export { BuildConfigAccordionSummary } from './build-config/BuildConfigAccordionSummary.js';
export { BuildConfigShell } from './build-config/BuildConfigShell.js';
export { DownloadRetryControls } from './build-config/DownloadRetryControls.js';
export type { DownloadRetryConfig } from './build-config/DownloadRetryControls.js';
export { FetchConfigSection } from './build-config/FetchConfigSection.js';
export { VTConfigSection } from './build-config/VTConfigSection.js';
export { WorkerNumberConfigCard } from './build-config/WorkerNumberConfigCard.js';
export { ZoomBandConfigSection } from './build-config/ZoomBandConfigSection.js';
export { ZoomBandRangeCard } from './build-config/ZoomBandRangeCard.js';
export { getBuildConfigHoverCardSx } from './build-config/buildConfigCardStyles.js';
