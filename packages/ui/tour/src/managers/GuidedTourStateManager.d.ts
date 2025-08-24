export declare class GuidedTourStateManager {
  private static instance;
  private tourState;
  private tourCompleted;
  private tourDisabled;
  static getInstance(): GuidedTourStateManager;
  startTour(tourId: string): void;
  endTour(tourId: string): void;
  isTourActive(tourId: string): boolean;
  markTourCompleted(tourId: string): void;
  isTourCompleted(tourId: string): boolean;
  setTourDisabled(tourId: string, disabled: boolean): void;
  isTourDisabled(tourId: string): boolean;
  reset(): void;
}
export default GuidedTourStateManager;
//# sourceMappingURL=GuidedTourStateManager.d.ts.map
