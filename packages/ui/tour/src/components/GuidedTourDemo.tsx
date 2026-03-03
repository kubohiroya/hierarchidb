/**
 * Demo component to test GuidedTour functionality
 */

import { Box, Button, Typography } from '@mui/material';
import type { Step } from 'react-joyride';
import { GenericGuidedTour } from './GenericGuidedTour.js';
import { useGuidedTourDemo } from './useGuidedTourDemo.js';

const createDemoSteps = (buttonTarget: string, contentTarget: string): Step[] => [
  {
    target: buttonTarget,
    placement: 'bottom',
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
  },
  {
    target: contentTarget,
    placement: 'top',
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
  },
];

export const GuidedTourDemo = () => {
  const { runTour, buttonId, contentId, startTour, finishTour, stepTargets } = useGuidedTourDemo();
  const demoSteps = createDemoSteps(stepTargets.buttonTarget, stepTargets.contentTarget);

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
