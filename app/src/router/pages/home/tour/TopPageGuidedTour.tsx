import { GenericGuidedTour } from '@hierarchidb/ui-plugin-shell/ui-tour';
import { Box, Typography } from '@mui/material';
import type { Step } from 'react-joyride';
import { useAppConfig } from '~/contexts/AppConfigContext.js';

interface TopPageGuidedTourProps {
  run: boolean;
  onFinish?: () => void;
}

// Custom Welcome Screen Component for Top Page
const TopPageWelcomeScreen = () => {
  const { appName } = useAppConfig();
  return (
    <Box
      sx={{
        padding: '32px 32px 20px 32px',
        textAlign: 'center',
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark' ? theme.palette.grey[900] : '#f5f5f5',
        minWidth: 500,
        maxWidth: 600,
        minHeight: 360,
        maxHeight: 600,
      }}
    >
      <Typography
        style={{ fontSize: '2rem', marginBottom: '1rem', marginTop: '5rem' }}
        variant="h1"
      >
        {`Welcome to ${appName}! 🎉`}
      </Typography>

      <Typography
        sx={{
          fontSize: '1.1rem',
          lineHeight: 1.6,
          marginBottom: '2rem',
          color: 'text.secondary',
        }}
      >
        {`${appName} is a powerful tree-structured data management system. This guided tour will help you understand the main features and navigation.`}
      </Typography>
    </Box>
  );
};

export const TopPageGuidedTour: React.FC<TopPageGuidedTourProps> = ({ run, onFinish }) => {
  const TOP_PAGE_TOUR_STEPS: Step[] = [
    {
      target: 'body',
      content: <TopPageWelcomeScreen />,
      placement: 'center',
      disableBeacon: true,
      styles: {
        options: {
          width: 'auto',
        },
        tooltip: {
          padding: 0,
          backgroundColor: 'transparent',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderRadius: '20px',
        },
        tooltipContent: {
          padding: 0,
        },
      },
    } as Step,
    {
      target: '[data-tour-id="home-tree-toggle"]',
      content: (
        <div>
          <h3>Tree Navigation 🌳</h3>
          <p>
            Use these buttons to jump into a tree. Each tree represents a separate data hierarchy.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour-id="home-user-menu"]',
      content: (
        <div>
          <h3>User Account 👤</h3>
          <p>
            {document.querySelector('[data-testid="user-login-button"]')
              ? 'Click here to log in to your account and access personalized features.'
              : 'Your account menu - manage your profile and settings.'}
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour-id="home-tags-button"]',
      content: (
        <div>
          <h3>Tags 🔖</h3>
          <p>
            Open the Tags page to explore and manage labels across your data.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour-id="home-help-button"]',
      content: (
        <div>
          <h3>Need Help? 🤝</h3>
          <p>
            You can reopen this guided tour anytime from the help icon.
          </p>
        </div>
      ),
      placement: 'left',
    },
  ];

  return (
    <GenericGuidedTour
      run={run}
      onFinish={onFinish}
      steps={TOP_PAGE_TOUR_STEPS}
      tourType="mainTour"
    />
  );
};
