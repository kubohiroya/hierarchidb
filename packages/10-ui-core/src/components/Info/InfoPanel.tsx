import { ReactNode } from 'react';
import { Box, Button } from '@mui/material';
import { Info as InfoIcon, HelpOutline } from '@mui/icons-material';

export interface InfoPanelAction {
  /**
   * Label for the button
   */
  label: string;
  /**
   * Icon to display in the button
   */
  icon?: ReactNode;
  /**
   * Click handler for the button
   */
  onClick: () => void;
  /**
   * Aria label for accessibility
   */
  ariaLabel?: string;
  /**
   * Button variant
   */
  variant?: 'text' | 'outlined' | 'contained';
  /**
   * Button color
   */
  color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
}

export interface InfoPanelProps {
  /**
   * Main content to display
   */
  children: ReactNode;
  /**
   * Whether to show the action buttons
   */
  showActions?: boolean;
  /**
   * Actions to display as buttons
   */
  actions?: InfoPanelAction[];
  /**
   * Callback when info button is clicked
   */
  onInfoClick?: () => void;
  /**
   * Callback when help/tour button is clicked
   */
  onHelpClick?: () => void;
  /**
   * Custom info button label
   */
  infoButtonLabel?: string;
  /**
   * Custom help button label
   */
  helpButtonLabel?: string;
  /**
   * Button styling configuration
   */
  buttonStyle?: {
    textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase';
    color?: string;
    borderColor?: string;
    borderRadius?: number;
  };
}

/**
 * A panel component that displays information content with optional action buttons
 */
export const InfoPanel = ({
  children,
  showActions = false,
  actions = [],
  onInfoClick,
  onHelpClick,
  infoButtonLabel = 'Info',
  helpButtonLabel = 'Help',
  buttonStyle = {
    textTransform: 'none',
    color: 'grey',
    borderColor: 'grey',
    borderRadius: 2,
  },
}: InfoPanelProps) => {
  // Build default actions if callbacks are provided
  const defaultActions: InfoPanelAction[] = [];

  if (onInfoClick) {
    defaultActions.push({
      label: infoButtonLabel,
      icon: <InfoIcon />,
      onClick: onInfoClick,
      ariaLabel: 'View documentation and information',
      variant: 'outlined',
    });
  }

  if (onHelpClick) {
    defaultActions.push({
      label: helpButtonLabel,
      icon: <HelpOutline />,
      onClick: onHelpClick,
      ariaLabel: 'Start guided tour',
      variant: 'outlined',
    });
  }

  const allActions = [...defaultActions, ...actions];

  return (
    <Box>
      {children}
      {showActions && allActions.length > 0 && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
          {allActions.map((action, index) => (
            <Button
              key={index}
              onClick={action.onClick}
              variant={action.variant || 'outlined'}
              color={action.color}
              startIcon={action.icon}
              aria-label={action.ariaLabel || action.label}
              sx={{
                textTransform: buttonStyle.textTransform,
                ...(buttonStyle.color && { color: buttonStyle.color }),
                ...(buttonStyle.borderColor && { borderColor: buttonStyle.borderColor }),
                ...(buttonStyle.borderRadius && { borderRadius: buttonStyle.borderRadius }),
              }}
            >
              {action.label}
            </Button>
          ))}
        </Box>
      )}
    </Box>
  );
};
