import { createTheme, PaletteMode, ThemeOptions } from '@mui/material/styles';

const getDesignTokens = (mode: PaletteMode): ThemeOptions => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // Light theme color definitions (Material Design 3 based)
          primary: {
            main: '#1976d2', // Classic blue
            light: '#42a5f5',
            dark: '#1565c0',
          },
          secondary: {
            main: '#9c27b0', // Purple
            light: '#ba68c8',
            dark: '#7b1fa2',
          },
          success: {
            main: '#4caf50', // Green
            light: '#81c784',
            dark: '#388e3c',
          },
          warning: {
            main: '#ff9800', // Orange
            light: '#ffb74d',
            dark: '#f57c00',
          },
          error: {
            main: '#f44336', // Red
            light: '#e57373',
            dark: '#d32f2f',
          },
          info: {
            main: '#2196f3', // Light blue
            light: '#64b5f6',
            dark: '#1976d2',
          },
          background: {
            default: '#fafafa', // Slightly greyish white
            paper: '#ffffff', // Pure white
          },
          text: {
            primary: '#212121', // Enhanced contrast for primary text (higher contrast than #1a1a1a)
            secondary: '#424242', // Better contrast grey (WCAG AA compliant)
            disabled: '#9e9e9e',
          },
          divider: 'rgba(0, 0, 0, 0.06)', // Border using transparency
          action: {
            hover: 'rgba(0, 0, 0, 0.08)', // Increased opacity for better contrast
            selected: 'rgba(0, 0, 0, 0.12)', // Increased opacity for better visibility
            disabled: 'rgba(0, 0, 0, 0.38)', // Darker disabled state
            disabledBackground: 'rgba(0, 0, 0, 0.12)',
          },
        }
      : {
          // Dark theme color definitions (refined Material Design 3 based)
          primary: {
            main: '#6db3f2', // Softer blue
            light: '#90caf9',
            dark: '#1976d2',
          },
          secondary: {
            main: '#ce93d8', // Light purple
            light: '#e1bee7',
            dark: '#ab47bc',
          },
          success: {
            main: '#81c784', // Green for dark theme
            light: '#a5d6a7',
            dark: '#66bb6a',
          },
          warning: {
            main: '#ffb74d', // Orange for dark theme
            light: '#ffcc02',
            dark: '#f57c00',
          },
          error: {
            main: '#f28b82', // Red for dark theme
            light: '#ffab91',
            dark: '#f44336',
          },
          info: {
            main: '#64b5f6', // Blue for dark theme
            light: '#81c784',
            dark: '#2196f3',
          },
          background: {
            default: '#0f0f0f', // Deeper black
            paper: '#1a1a1a', // Background for cards and dialogs
          },
          text: {
            primary: '#ffffff', // Pure white for better contrast
            secondary: '#b3b3b3', // Improved contrast grey for dark theme
            disabled: '#757575',
          },
          divider: 'rgba(232, 234, 237, 0.03)', // Border using transparency
          action: {
            hover: 'rgba(255, 255, 255, 0.08)', // Increased opacity for better contrast in dark mode
            selected: 'rgba(255, 255, 255, 0.16)', // Higher opacity for visibility
            disabled: 'rgba(255, 255, 255, 0.38)', // Better contrast for disabled items
            disabledBackground: 'rgba(255, 255, 255, 0.12)',
          },
        }),
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        body: {
          transition: 'background-color 0.3s ease, color 0.3s ease',
          // Improve layout at high zoom levels
          minWidth: '320px', // Prevent layout break at small widths
          overflowX: 'auto', // Allow horizontal scroll when needed
        },
        // Ensure responsive layout for high zoom
        'html, body': {
          maxWidth: '100vw',
          overflowX: 'hidden', // Prevent horizontal scroll at root level
        },
        // Text selection styles for better visibility in dark mode
        '::selection': {
          backgroundColor:
            theme.palette.mode === 'dark'
              ? 'rgba(109, 179, 242, 0.3)' // Darker blue with opacity for dark mode
              : 'rgba(33, 150, 243, 0.3)', // Standard selection for light mode
          color: theme.palette.mode === 'dark' ? theme.palette.text.primary : undefined,
        },
        '::-moz-selection': {
          backgroundColor:
            theme.palette.mode === 'dark'
              ? 'rgba(109, 179, 242, 0.3)' // Darker blue with opacity for dark mode
              : 'rgba(33, 150, 243, 0.3)', // Standard selection for light mode
          color: theme.palette.mode === 'dark' ? theme.palette.text.primary : undefined,
        },
        // Specific selection styles for input fields
        'input::selection, textarea::selection': {
          backgroundColor:
            theme.palette.mode === 'dark'
              ? 'rgba(109, 179, 242, 0.4)' // Even darker for input fields in dark mode
              : 'rgba(33, 150, 243, 0.3)',
          color: theme.palette.mode === 'dark' ? theme.palette.text.primary : undefined,
        },
        'input::-moz-selection, textarea::-moz-selection': {
          backgroundColor:
            theme.palette.mode === 'dark'
              ? 'rgba(109, 179, 242, 0.4)' // Even darker for input fields in dark mode
              : 'rgba(33, 150, 243, 0.3)',
          color: theme.palette.mode === 'dark' ? theme.palette.text.primary : undefined,
        },
        ':root': {
          // Define theme colors with CSS custom properties
          '--color-success-light':
            theme.palette.mode === 'dark' ? 'rgba(129, 199, 132, 0.15)' : 'rgba(76, 175, 80, 0.15)',
          '--color-success-main': theme.palette.success.main,
          '--color-success-shadow':
            theme.palette.mode === 'dark' ? 'rgba(129, 199, 132, 0.4)' : 'rgba(76, 175, 80, 0.4)',
          '--color-error-light':
            theme.palette.mode === 'dark' ? 'rgba(242, 139, 130, 0.1)' : 'rgba(244, 67, 54, 0.1)',
          '--color-error-main': theme.palette.error.main,
          '--color-primary-light':
            theme.palette.mode === 'dark'
              ? 'rgba(109, 179, 242, 0.15)'
              : 'rgba(33, 150, 243, 0.15)',
          '--color-primary-main': theme.palette.primary.main,
          '--color-primary-shadow':
            theme.palette.mode === 'dark' ? 'rgba(109, 179, 242, 0.4)' : 'rgba(33, 150, 243, 0.4)',
          '--color-shadow-dark':
            theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.2)',
          '--color-hover-light':
            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
          '--color-background-drag': theme.palette.mode === 'dark' ? '#1976d2' : '#e3f2fd',
          '--color-background-disabled':
            theme.palette.grey[theme.palette.mode === 'dark' ? 800 : 100],
          '--color-text-disabled':
            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
          '--color-background-overlay':
            theme.palette.mode === 'dark' ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',

          // TreeTable header background colors
          '--color-table-header-bg': theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5',
          '--color-table-header-hover': theme.palette.mode === 'dark' ? '#333333' : '#eeeeee',
        },

        // High contrast mode support
        '@media (prefers-contrast: high)': {
          // Increase contrast ratios for high contrast mode
          body: {
            backgroundColor: theme.palette.mode === 'dark' ? '#000000' : '#ffffff',
            color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
          },
          // Ensure buttons and interactive elements have strong borders
          "button, [role='button']": {
            border: theme.palette.mode === 'dark' ? '2px solid #ffffff' : '2px solid #000000',
          },
          // Ensure focus indicators are very visible
          '*:focus-visible': {
            outline: theme.palette.mode === 'dark' ? '3px solid #ffffff' : '3px solid #000000',
            outlineOffset: '2px',
          },
        },

        // Reduced motion support
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      }),
    },
    MuiTypography: {
      defaultProps: {
        textTransform: 'none',
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: 'none', // Disable gradients
          transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
          ...(theme.palette.mode === 'dark' && {
            border: `1px solid rgba(232, 234, 237, 0.08)`,
          }),
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: 'none',
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          boxShadow: `0 1px 0 ${theme.palette.divider}`,
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: '16px',
          backgroundImage: 'none',
          ...(theme.palette.mode === 'dark' && {
            border: `1px solid rgba(232, 234, 237, 0.08)`,
          }),
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: '12px',
          backgroundImage: 'none',
          transition: 'all 0.3s ease',
          ...(theme.palette.mode === 'dark' && {
            border: `1px solid rgba(232, 234, 237, 0.08)`,
          }),
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[8],
          },
        }),
      },
    },
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 500,
          transition: 'all 0.3s ease',
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px',
          },
        }),
        contained: ({ theme }) => ({
          boxShadow: 'none',
          '&:hover': {
            boxShadow: theme.shadows[4],
            transform: 'translateY(-1px)',
          },
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.contrastText}`,
            outlineOffset: '2px',
          },
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: '8px',
          transition: 'all 0.2s ease',
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px',
          },
        }),
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            transition: 'all 0.3s ease',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: theme.palette.primary.main,
            },
          },
        }),
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: ({ theme }) => ({
          margin: 0.5,
          borderRadius: '8px',
          backgroundImage: 'none',
          '&:before': {
            display: 'none',
          },
          '&.Mui-expanded': {
            margin: 0.5,
          },
          ...(theme.palette.mode === 'dark' && {
            border: `1px solid rgba(232, 234, 237, 0.08)`,
          }),
        }),
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          minHeight: 0,
          borderRadius: '8px 8px 0 0',
          '&.Mui-expanded': {
            minHeight: 0,
          },
        },
        content: {
          padding: '0 0 0 0',
          margin: '4px 3px 4px 0px',
          '&.Mui-expanded': {},
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          marginTop: 0,
          padding: '0px 8px 4px 16px',
          marginBottom: 8,
          '&.Mui-padding': {},
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme }) => ({
          borderRadius: '8px',
          fontSize: '0.75rem',
          backgroundColor:
            theme.palette.mode === 'dark' ? 'rgba(232, 234, 237, 0.9)' : 'rgba(0, 0, 0, 0.9)',
          color: theme.palette.mode === 'dark' ? '#0f0f0f' : '#ffffff',
        }),
      },
    },
  },
});

export const createAppTheme = (mode: PaletteMode) => {
  const theme = createTheme(getDesignTokens(mode));

  // Add CSS custom properties for TreeTable styling
  const root = document.documentElement;
  if (root) {
    // Define CSS variables based on theme
    root.style.setProperty(
      '--color-success-light',
      mode === 'dark' ? 'rgba(46, 125, 50, 0.16)' : 'rgba(76, 175, 80, 0.16)'
    );
    root.style.setProperty('--color-success-main', mode === 'dark' ? '#2e7d32' : '#4caf50');
    root.style.setProperty(
      '--color-success-shadow',
      mode === 'dark' ? 'rgba(46, 125, 50, 0.4)' : 'rgba(76, 175, 80, 0.4)'
    );

    root.style.setProperty(
      '--color-error-light',
      mode === 'dark' ? 'rgba(211, 47, 47, 0.16)' : 'rgba(244, 67, 54, 0.16)'
    );
    root.style.setProperty('--color-error-main', mode === 'dark' ? '#d32f2f' : '#f44336');

    root.style.setProperty(
      '--color-primary-light',
      mode === 'dark' ? 'rgba(144, 202, 249, 0.16)' : 'rgba(25, 118, 210, 0.16)'
    );
    root.style.setProperty('--color-primary-main', mode === 'dark' ? '#90caf9' : '#1976d2');
    root.style.setProperty(
      '--color-primary-shadow',
      mode === 'dark' ? 'rgba(144, 202, 249, 0.4)' : 'rgba(25, 118, 210, 0.4)'
    );

    root.style.setProperty(
      '--color-shadow-dark',
      mode === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.3)'
    );
    root.style.setProperty(
      '--color-hover-light',
      mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'
    );
    root.style.setProperty('--color-background-drag', mode === 'dark' ? '#242424' : '#fafafa');
    root.style.setProperty(
      '--color-background-overlay',
      mode === 'dark' ? 'rgba(18, 18, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)'
    );

    root.style.setProperty('--mui-palette-text-primary', theme.palette.text.primary);

    // Additional TreeTable-specific colors
    root.style.setProperty(
      '--color-divider-light',
      mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.06)'
    );
    root.style.setProperty('--color-drop-target', mode === 'dark' ? '#1e3a5f' : '#e3f2fd');
    root.style.setProperty('--color-drop-not-allowed', mode === 'dark' ? '#2e2e2e' : '#f5f5f5');
    root.style.setProperty(
      '--color-text-disabled',
      mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'
    );
    root.style.setProperty(
      '--color-resizer-hover',
      mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
    );
    root.style.setProperty(
      '--color-resizer-active',
      mode === 'dark' ? 'rgba(144, 202, 249, 0.5)' : 'rgba(25, 118, 210, 0.5)'
    );

    // TreeTable header background colors
    root.style.setProperty('--color-table-header-bg', mode === 'dark' ? '#2a2a2a' : '#f5f5f5');
    root.style.setProperty('--color-table-header-hover', mode === 'dark' ? '#333333' : '#eeeeee');

    // Debug: Check if CSS variables are set
  }

  return theme;
};

// Default export for backward compatibility (light theme)
export default createAppTheme('light');
