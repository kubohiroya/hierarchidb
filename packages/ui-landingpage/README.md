# @hierarchidb/ui-landingpage

A reusable landing page component abstracted from the ERIA-Cartograph Vite app landing screen.

Features:
- Customizable logo, heading, description
- Optional GitHub link
- Info button that navigates to a provided path
- Help button that triggers a provided action
- Top-left and top-right overlay slots via children (first child -> top-left, second child -> top-right)

## Installation
This package is part of the monorepo; it will be built via `pnpm -w build`.

## Usage

```tsx
import { LandingPage } from '@hierarchidb/ui-landingpage';
import { Box, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router';

function Example() {
  const [showHelp, setShowHelp] = useState(false);
  const navigate = useNavigate();

  return (
    <LandingPage
      logo={<Box>/* Your Logo */</Box>}
      heading={<span>My Application</span>}
      description={<span>A concise description of your app.</span>}
      githubUrl="https://github.com/your/repo"
      infoPath="/app/info"
      onHelp={() => setShowHelp(true)}
    >
      {/* first child -> top-left */}
      <Typography variant="body2">v1.0.0</Typography>
      {/* second child -> top-right */}
      <Typography variant="body2">Signed in as Alice</Typography>
    </LandingPage>
  );
}
```

## ERIA-Cartograph Example
Below is how the component can be used to recreate the ERIA-Cartograph landing page behavior (simplified):

```tsx
import { LandingPage } from '@hierarchidb/ui-landingpage';
import { lazy, Suspense, useEffect, useState } from 'react';
import { LinearProgress } from '@mui/material';
import { useNavigate } from 'react-router';
import { APP_PREFIX } from '@/config/appDescription';
import { EriaCartLogo } from '@/domains/info/EriaCartLogo';

const TopPageGuidedTour = lazy(() => import('@/domains/guides/TopPageGuidedTour').then(m => ({ default: m.TopPageGuidedTour })));

export default function Main() {
  const [runTour, setRunTour] = useState(false);
  const isE2ETest = import.meta.env.VITE_E2E_TEST === 'true';

  useEffect(() => {
    import('./info').catch(() => {});
  }, []);

  return (
    <Suspense fallback={<LinearProgress color="inherit" variant="indeterminate" aria-label="Loading page" /> }>
      <LandingPage
        logo={<EriaCartLogo />}
        heading={<span>ERIA Cartograph</span>}
        description={<span>A web application for visualizing and analyzing geospatial data.</span>}
        githubUrl="https://github.com/kubohiroya/eria-cartograph"
        infoPath={`/${APP_PREFIX}/info`}
        onHelp={() => setRunTour(true)}
      />
      {!isE2ETest && (
        <Suspense fallback={null}>
          <TopPageGuidedTour run={runTour} onFinish={() => setRunTour(false)} />
        </Suspense>
      )}
    </Suspense>
  );
}
```

Notes:
- The first child becomes the top-left overlay; the second child becomes the top-right overlay.
- If `infoPath` is provided, the Info button will be shown by default. If `onHelp` is provided, the Help button will be shown by default.
