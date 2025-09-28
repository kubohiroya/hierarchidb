export interface StageControls {
  /**
   * Called by stage adapters before pulling the next unit of work. Should
   * resolve immediately when the stage is allowed to continue, or wait until
   * a resume command is issued.
   */
  waitIfPaused?: () => Promise<void>;
}
