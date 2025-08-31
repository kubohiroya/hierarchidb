/**
 * Demo component to test GuidedTour functionality
 */

import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { GenericGuidedTour } from './GenericGuidedTour';
import type { Step } from 'react-joyride';

const demoSteps: Step[] = [
  {
    target: '#demo-button',
    content: (
      <Box>
        <Typography variant="h6" gutterBottom>
          Welcome to the GuidedTour Demo!
        </Typography>
        <Typography>
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
    target: '#demo-content',
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
  const [runTour, setRunTour] = useState(true);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        GuidedTour Demo
      </Typography>

      <Button id="demo-button" variant="contained" onClick={() => setRunTour(true)} sx={{ mb: 4 }}>
        Start Tour
      </Button>

      <Box
        id="demo-content"
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
        onFinish={() => setRunTour(false)}
      />
    </Box>
  );
};
