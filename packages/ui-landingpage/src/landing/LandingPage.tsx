import { Box, Button, Link as MuiLink, Stack, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { ReactNode } from 'react';

export interface LandingPageProps {
  logo?: ReactNode;
  heading: ReactNode;
  description?: ReactNode;
  githubUrl?: string;
  infoPath?: string; // e.g., "/src/info" - for backward compatibility
  onInfoClick?: () => void; // Callback for info button click
  onHelp?: () => void;
  showInfoButton?: boolean; // default: true if infoPath or onInfoClick is provided
  showHelpButton?: boolean; // default: true if onHelp is provided
  children?: ReactNode; // first child -> top-left, second child -> top-right
}

/**
 * Generic Landing Page component that abstracts the ERIA-Cartograph landing page structure.
 * - Places first child in top-left and second child in top-right as overlay areas.
 * - Centers logo, heading, description in the viewport.
 * - Provides Info and Help buttons that can be wired by props.
 */
export function LandingPage(props: LandingPageProps) {
  const {
    logo,
    heading,
    description,
    githubUrl,
    infoPath,
    onInfoClick,
    onHelp,
    showInfoButton,
    showHelpButton,
    children,
  } = props;

  const childArray = (
    children ? (Array.isArray(children) ? children : [children]) : []
  ) as ReactNode[];
  const topLeft = childArray[0];
  const topRight = childArray[1];

  const shouldShowInfo = showInfoButton ?? Boolean(infoPath || onInfoClick);
  const shouldShowHelp = showHelpButton ?? Boolean(onHelp);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* Top overlay slots */}
      <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>{topLeft}</Box>
      <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>{topRight}</Box>

      {/* Centered content */}
      <Stack
        sx={{ height: '100%', width: '100%', maxWidth: 600, margin: '0 auto', px: 2 }}
        alignItems={'center'}
        justifyContent={'center'}
        spacing={2}
      >
        {(logo || heading) && (
          <Stack spacing={1} alignItems={'center'}>
            {logo}
            {heading && (
              <Typography variant="h3" component="h1" color="grey" textAlign="center">
                {heading}
              </Typography>
            )}
          </Stack>
        )}

        {description && (
          <Typography color={'Grey'} textAlign={'center'} sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}

        {githubUrl && (
          <Typography variant="body2" color={'lightGrey'}>
            <MuiLink
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: 'primary.main' }}
            >
              available on GitHub
            </MuiLink>
          </Typography>
        )}

        {(shouldShowInfo || shouldShowHelp) && (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 1 }}>
            {shouldShowInfo && (infoPath || onInfoClick) && (
              <Button
                component={onInfoClick ? 'button' : 'a'}
                href={onInfoClick ? undefined : infoPath}
                onClick={onInfoClick}
                variant="outlined"
                startIcon={<InfoOutlinedIcon />}
                aria-label="View documentation and information"
                sx={{ textTransform: 'none', color: 'grey', borderColor: 'grey', borderRadius: 2 }}
              >
                Info
              </Button>
            )}
            {shouldShowHelp && (
              <Button
                onClick={onHelp}
                variant="outlined"
                startIcon={<HelpOutlineIcon />}
                aria-label="Start guided tour"
                sx={{ textTransform: 'none', color: 'grey', borderColor: 'grey', borderRadius: 2 }}
              >
                Help
              </Button>
            )}
          </Box>
        )}
      </Stack>
    </Box>
  );
}
