import React from 'react';
// GuidedTour component not available, creating stub
const GenericGuidedTour = (_props: any) => null;

export const guidedTours = {
  welcome: {
    id: 'welcome',
    name: 'Welcome Tour',
    steps: [
      {
        target: '.welcome-step',
        content: 'Welcome to HierarchiDB!',
        placement: 'center' as const,
      },
    ],
  },
  features: {
    id: 'features',
    name: 'Features Tour',
    steps: [
      {
        target: '.feature-step',
        content: 'Explore our features',
        placement: 'bottom' as const,
      },
    ],
  },
};

export const TopPageGuidedTour: React.FC<{ run: boolean; onFinish?: () => void }> = ({
  run,
  onFinish,
}) => {
  return (
    <GenericGuidedTour
      run={run}
      onFinish={onFinish}
      steps={guidedTours.welcome.steps}
      tourType="welcome"
    />
  );
};

export default guidedTours;
