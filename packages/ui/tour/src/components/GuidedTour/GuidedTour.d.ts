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
export declare const GuidedTour: ({
  run,
  onFinish,
}: GuidedTourProps) => import('react/jsx-runtime').JSX.Element;
export {};
//# sourceMappingURL=GuidedTour.d.ts.map
