import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
/**
 * Demo component to test GuidedTour functionality
 */
import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { GenericGuidedTour } from './GenericGuidedTour';
const demoSteps = [
  {
    target: '#demo-button',
    content: _jsxs(Box, {
      children: [
        _jsx(Typography, {
          variant: 'h6',
          gutterBottom: true,
          children: 'Welcome to the GuidedTour Demo!',
        }),
        _jsxs(Typography, {
          children: [
            'This is a demo of the enhanced GuidedTour with:',
            _jsxs('ul', {
              children: [
                _jsx('li', { children: 'ESC key support to close the tour' }),
                _jsx('li', { children: 'Enhanced backdrop with blur effect' }),
                _jsx('li', { children: 'Glowing yellow spotlight border' }),
              ],
            }),
          ],
        }),
      ],
    }),
    placement: 'bottom',
  },
  {
    target: '#demo-content',
    content: _jsxs(Box, {
      children: [
        _jsx(Typography, { variant: 'h6', gutterBottom: true, children: 'Content Area' }),
        _jsx(Typography, {
          children:
            'The backdrop creates a strong focus on the highlighted element. Try pressing ESC to close the tour at any time!',
        }),
      ],
    }),
    placement: 'top',
  },
];
export const GuidedTourDemo = () => {
  const [runTour, setRunTour] = useState(true);
  return _jsxs(Box, {
    sx: { p: 4 },
    children: [
      _jsx(Typography, { variant: 'h4', gutterBottom: true, children: 'GuidedTour Demo' }),
      _jsx(Button, {
        id: 'demo-button',
        variant: 'contained',
        onClick: () => setRunTour(true),
        sx: { mb: 4 },
        children: 'Start Tour',
      }),
      _jsxs(Box, {
        id: 'demo-content',
        sx: {
          p: 3,
          border: '1px solid #ccc',
          borderRadius: 2,
          backgroundColor: '#f5f5f5',
        },
        children: [
          _jsx(Typography, { variant: 'h6', children: 'Demo Content' }),
          _jsx(Typography, {
            children:
              'This is a demo content area. The tour will highlight different parts of this demo page.',
          }),
        ],
      }),
      _jsx(GenericGuidedTour, {
        run: runTour,
        steps: demoSteps,
        tourType: 'mainTour',
        onFinish: () => setRunTour(false),
      }),
    ],
  });
};
//# sourceMappingURL=GuidedTourDemo.js.map
