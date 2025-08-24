// Export component prop types
export type { ConfigAccordionProps } from '../components/ConfigAccordion';
export type { PhaseConfigAccordionProps, PhaseConfig } from '../components/PhaseConfigAccordion';
export type { CacheConfig, CacheStats } from '../sections/CacheSection';
export type { ConcurrencyConfig, ConcurrencySectionProps } from '../sections/ConcurrencySection';

// Common accordion themes
export interface AccordionTheme {
  phaseColorsLight: Record<number, string>;
  phaseColorsDark: Record<number, string>;
}

export type AccordionPhaseTheme = 'light' | 'dark';

export const defaultAccordionTheme: AccordionTheme = {
  phaseColorsLight: {
    1: '#f5f5f5', // Light gray
    2: '#efefff', // Light blue  
    3: '#fff0ff', // Light purple
    4: '#efffef', // Light green
    5: '#fff8e1', // Light yellow
    6: '#fce4ec', // Light pink
  },
  phaseColorsDark: {
    1: 'rgba(255, 255, 255, 0.05)', // Very subtle white
    2: 'rgba(144, 202, 249, 0.08)', // Subtle blue
    3: 'rgba(186, 104, 200, 0.08)', // Subtle purple
    4: 'rgba(129, 199, 132, 0.08)', // Subtle green
    5: 'rgba(255, 235, 59, 0.08)', // Subtle yellow
    6: 'rgba(233, 30, 99, 0.08)', // Subtle pink
  },
};

// Utility types for accordion configuration
export interface BaseAccordionConfig {
  id?: string;
  title: string;
  description?: string;
  defaultExpanded?: boolean;
  disabled?: boolean;
}

export interface AccordionGroup {
  id: string;
  title: string;
  accordions: BaseAccordionConfig[];
}