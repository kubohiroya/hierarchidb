import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Stack,
  useTheme,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

export interface ConfigAccordionProps {
  /** Unique identifier for the accordion */
  id?: string;
  /** Icon to display in the title (emoji or component) */
  icon?: React.ReactNode;
  /** Title text */
  title: string;
  /** Description text shown below the title */
  description?: string;
  /** Whether the accordion is expanded by default */
  defaultExpanded?: boolean;
  /** Whether the accordion is disabled */
  disabled?: boolean;
  /** Background color theme for the accordion header */
  headerColor?: string;
  /** Custom styling for the accordion */
  sx?: object;
  /** Child components to render in the accordion details */
  children: React.ReactNode;
  /** Callback when accordion expansion changes */
  onExpansionChange?: (expanded: boolean) => void;
}

export const ConfigAccordion: React.FC<ConfigAccordionProps> = ({
  id,
  icon,
  title,
  description,
  defaultExpanded = true,
  disabled = false,
  headerColor,
  sx = {},
  children,
  onExpansionChange,
}) => {
  const theme = useTheme();

  const getHeaderBackgroundColor = () => {
    if (headerColor) return headerColor;
    
    // Default theme-aware background
    return theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.05)' 
      : theme.palette.grey[50];
  };

  const handleExpansionChange = (_event: React.SyntheticEvent, isExpanded: boolean) => {
    onExpansionChange?.(isExpanded);
  };

  return (
    <Accordion 
      id={id}
      defaultExpanded={defaultExpanded}
      disabled={disabled}
      onChange={handleExpansionChange}
      sx={sx}
    >
      <AccordionSummary 
        expandIcon={<ExpandMoreIcon />}
        sx={{ 
          backgroundColor: getHeaderBackgroundColor(),
          px: 3,
          py: 1,
          '&:hover': {
            backgroundColor: getHeaderBackgroundColor(),
            filter: theme.palette.mode === 'dark' ? 'brightness(1.2)' : 'brightness(0.95)',
          },
          '&.Mui-disabled': {
            backgroundColor: theme.palette.action.disabledBackground,
          }
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, width: '100%' }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {icon && (
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {typeof icon === 'string' ? (
                  <Typography component="span" sx={{ fontSize: '1.2em' }}>{icon}</Typography>
                ) : (
                  icon
                )}
              </Box>
            )}
            <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
              {title}
            </Typography>
          </Box>
          {description && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 3, py: 2 }}>
        <Stack spacing={2}>
          {children}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};