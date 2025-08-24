import React from 'react';
import type { TourStep } from '@hierarchidb/ui-tour';
import { Box, Typography } from '@mui/material';
import { GenericGuidedTour } from '@hierarchidb/ui-tour';

interface TopPageGuidedTourProps {
  run: boolean;
  onFinish?: () => void;
}

// Custom Welcome Screen Component for Top Page
const TopPageWelcomeScreen = () => {
  return (
    <Box
      sx={{
        padding: "32px 32px 20px 32px",
        textAlign: "center",
        backgroundColor: (theme) => theme.palette.mode === 'dark' ? theme.palette.grey[900] : "#f5f5f5",
        minWidth: 500,
        maxWidth: 600,
        minHeight: 360,
        maxHeight: 600,
      }}
    >
      <Typography
        style={{ fontSize: "2rem", marginBottom: "1rem", marginTop: "5rem" }}
        variant="h1"
      >
        Welcome to HierarchiDB! 🎉
      </Typography>

      <Typography
        sx={{
          fontSize: "1.1rem",
          lineHeight: 1.6,
          marginBottom: "2rem",
          color: "text.secondary",
        }}
      >
        HierarchiDB is a powerful tree-structured data management system.
        This guided tour will help you understand the main features and navigation.
      </Typography>
    </Box>
  );
};

export const TopPageGuidedTour: React.FC<TopPageGuidedTourProps> = ({ run, onFinish }) => {
  const TOP_PAGE_TOUR_STEPS: TourStep[] = [
    {
      target: "body",
      content: <TopPageWelcomeScreen />,
      placement: "center",
      disableBeacon: true,
      styles: {
        options: {
          width: "auto",
        },
        tooltip: {
          padding: 0,
          backgroundColor: "transparent",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          borderRadius: "20px",
        },
        tooltipContent: {
          padding: 0,
        },
      },
    } as TourStep,
    {
      target: '[aria-label="tree selection"]',
      content: (
        <div>
          <h3>Tree Navigation 🌳</h3>
          <p>
            Use these toggle buttons to switch between different trees.
            Each tree represents a separate data hierarchy.
          </p>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[aria-label="User menu"], [data-testid="user-login-button"]',
      content: (
        <div>
          <h3>User Account 👤</h3>
          <p>
            {document.querySelector('[data-testid="user-login-button"]') ? 
              'Click here to log in to your account and access personalized features.' :
              'Your account menu - manage your profile and settings.'
            }
          </p>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[aria-label="Tree console toolbar"]',
      content: (
        <div>
          <h3>Toolbar Actions 🔧</h3>
          <p>
            The toolbar provides quick access to common actions like creating new nodes,
            editing, deleting, and managing your tree data.
          </p>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: '[aria-label="Create Action"]',
      content: (
        <div>
          <h3>Quick Create ⚡</h3>
          <p>
            Use the floating action button to quickly create new items in your tree.
            This is the fastest way to add new data.
          </p>
        </div>
      ),
      placement: "left",
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