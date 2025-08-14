export class GuidedTourStateManager {
  private static instance: GuidedTourStateManager;
  private tourState: Map<string, boolean> = new Map();
  private tourCompleted: Map<string, boolean> = new Map();
  private tourDisabled: Map<string, boolean> = new Map();

  static getInstance(): GuidedTourStateManager {
    if (!GuidedTourStateManager.instance) {
      GuidedTourStateManager.instance = new GuidedTourStateManager();
    }
    return GuidedTourStateManager.instance;
  }

  startTour(tourId: string): void {
    this.tourState.set(tourId, true);
  }

  endTour(tourId: string): void {
    this.tourState.set(tourId, false);
  }

  isTourActive(tourId: string): boolean {
    return this.tourState.get(tourId) || false;
  }

  markTourCompleted(tourId: string): void {
    this.tourCompleted.set(tourId, true);
  }

  isTourCompleted(tourId: string): boolean {
    return this.tourCompleted.get(tourId) || false;
  }

  setTourDisabled(tourId: string, disabled: boolean): void {
    this.tourDisabled.set(tourId, disabled);
  }

  isTourDisabled(tourId: string): boolean {
    return this.tourDisabled.get(tourId) || false;
  }

  reset(): void {
    this.tourState.clear();
    this.tourCompleted.clear();
    this.tourDisabled.clear();
  }
}

export default GuidedTourStateManager;
