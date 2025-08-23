import { useTheme } from '@mui/material';
import { ConfigAccordion, ConfigAccordionProps } from './ConfigAccordion';

export interface PhaseConfig {
  /** Phase number (used for consistent coloring) */
  phase: number;
  /** Icon for the phase */
  icon: React.ReactNode;
  /** Title for the phase */
  title: string;
  /** Description for the phase */
  description: string;
  /** Custom color override for this phase */
  color?: string;
}

export interface PhaseConfigAccordionProps extends Omit<ConfigAccordionProps, 'headerColor'> {
  /** Phase number (used for consistent coloring) */
  phase: number;
  /** Theme mode override */
  theme?: 'light' | 'dark';
  /** Custom phase colors (light mode) */
  phaseColorsLight?: Record<number, string>;
  /** Custom phase colors (dark mode) */
  phaseColorsDark?: Record<number, string>;
  /** Whether to show phase number in title */
  showPhaseNumber?: boolean;
  /** Phase number label format */
  phaseLabel?: string;
}

const defaultPhaseColorsLight: Record<number, string> = {
  1: '#f5f5f5', // Light gray
  2: '#efefff', // Light blue
  3: '#fff0ff', // Light purple
  4: '#efffef', // Light green
  5: '#fff8e1', // Light yellow
  6: '#fce4ec', // Light pink
};

const defaultPhaseColorsDark: Record<number, string> = {
  1: 'rgba(255, 255, 255, 0.05)', // Very subtle white
  2: 'rgba(144, 202, 249, 0.08)', // Subtle blue
  3: 'rgba(186, 104, 200, 0.08)', // Subtle purple
  4: 'rgba(129, 199, 132, 0.08)', // Subtle green
  5: 'rgba(255, 235, 59, 0.08)', // Subtle yellow
  6: 'rgba(233, 30, 99, 0.08)', // Subtle pink
};

export const PhaseConfigAccordion: React.FC<PhaseConfigAccordionProps> = ({
  phase,
  title,
  description,
  icon,
  theme: themeOverride,
  phaseColorsLight = defaultPhaseColorsLight,
  phaseColorsDark = defaultPhaseColorsDark,
  showPhaseNumber = true,
  phaseLabel = 'Phase',
  ...accordionProps
}) => {
  const muiTheme = useTheme();
  const isDark = themeOverride === 'dark' || (themeOverride !== 'light' && muiTheme.palette.mode === 'dark');
  
  const phaseColors = isDark ? phaseColorsDark : phaseColorsLight;
  const headerColor = phaseColors[phase] || phaseColors[1];
  
  const displayTitle = showPhaseNumber 
    ? `[${phaseLabel} ${phase}] ${title}`
    : title;

  return (
    <ConfigAccordion
      {...accordionProps}
      icon={icon}
      title={displayTitle}
      description={description}
      headerColor={headerColor}
    />
  );
};