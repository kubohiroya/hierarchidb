// import { TopPageGuidedTour } from "@/domains/app-config/guides";
import { GenericGuidedTour } from './GenericGuidedTour';

const TopPageGuidedTour = ({ run, onFinish }: { run: boolean; onFinish?: () => void }) => {
  return (
    <GenericGuidedTour
      run={run}
      onFinish={onFinish}
      steps={[
        {
          target: '.welcome-step',
          content: 'Welcome to HierarchiDB!',
          placement: 'center' as const,
        },
      ]}
      tourType="welcome"
    />
  );
};

interface GuidedTourProps {
  run: boolean;
  onFinish?: () => void;
}

/**
 * Legacy GuidedTour component for backward compatibility.
 * This component is now a wrapper around TopPageGuidedTour.
 *
 * @deprecated Use TopPageGuidedTour directly instead
 */
export const GuidedTour = ({ run, onFinish }: GuidedTourProps) => {
  return <TopPageGuidedTour run={run} onFinish={onFinish} />;
};
