export class GuidedTourStateManager {
  constructor() {
    this.tourState = new Map();
    this.tourCompleted = new Map();
    this.tourDisabled = new Map();
  }
  static getInstance() {
    if (!GuidedTourStateManager.instance) {
      GuidedTourStateManager.instance = new GuidedTourStateManager();
    }
    return GuidedTourStateManager.instance;
  }
  startTour(tourId) {
    this.tourState.set(tourId, true);
  }
  endTour(tourId) {
    this.tourState.set(tourId, false);
  }
  isTourActive(tourId) {
    return this.tourState.get(tourId) || false;
  }
  markTourCompleted(tourId) {
    this.tourCompleted.set(tourId, true);
  }
  isTourCompleted(tourId) {
    return this.tourCompleted.get(tourId) || false;
  }
  setTourDisabled(tourId, disabled) {
    this.tourDisabled.set(tourId, disabled);
  }
  isTourDisabled(tourId) {
    return this.tourDisabled.get(tourId) || false;
  }
  reset() {
    this.tourState.clear();
    this.tourCompleted.clear();
    this.tourDisabled.clear();
  }
}
export default GuidedTourStateManager;
//# sourceMappingURL=GuidedTourStateManager.js.map
