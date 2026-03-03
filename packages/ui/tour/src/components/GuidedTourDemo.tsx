/**
 * Demo component to test GuidedTour functionality
 */

import { Box, Button, Typography } from '@mui/material';
import { useMemo } from 'react';
import type { Step } from 'react-joyride';
import { GenericGuidedTour } from './GenericGuidedTour.js';
import { useGuidedTourDemoView } from './useGuidedTourDemoView.js';

const createDemoSteps = (buttonId: string, contentId: string): Step[] => [
  {
    target: `#${buttonId}`,
    content: (
      <Box>
        <Typography variant="h6" gutterBottom>
          Welcome to the GuidedTour Demo!
        </Typography>
        <Typography component="div">
          This is a demo of the enhanced GuidedTour with:
          <ul>
            <li>ESC key support to close the tour</li>
            <li>Enhanced backdrop with blur effect</li>
            <li>Glowing yellow spotlight border</li>
          </ul>
        </Typography>
      </Box>
    ),
    placement: 'bottom',
  },
  {
    target: `#${contentId}`,
    content: (
      <Box>
        <Typography variant="h6" gutterBottom>
          Content Area
        </Typography>
        <Typography>
          The backdrop creates a strong focus on the highlighted element. Try pressing ESC to close
          the tour at any time!
        </Typography>
      </Box>
    ),
    placement: 'top',
  },
];

export const GuidedTourDemo = () => {
  const { runTour, buttonId, contentId, startTour, finishTour } = useGuidedTourDemoView();
  const demoSteps = useMemo(() => createDemoSteps(buttonId, contentId), [buttonId, contentId]);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        GuidedTour Demo
      </Typography>

      <Button id={buttonId} variant="contained" onClick={startTour} sx={{ mb: 4 }}>
        Start Tour
      </Button>

      <Box
        id={contentId}
        sx={{
          p: 3,
          border: '1px solid #ccc',
          borderRadius: 2,
          backgroundColor: '#f5f5f5',
        }}
      >
        <Typography variant="h6">Demo Content</Typography>
        <Typography>
          This is a demo content area. The tour will highlight different parts of this demo page.
        </Typography>
      </Box>

      <GenericGuidedTour
        run={runTour}
        steps={demoSteps}
        tourType="mainTour"
        onFinish={finishTour}
      />
    </Box>
  );
};
