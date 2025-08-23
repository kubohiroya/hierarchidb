/**
 * Types for TreeConsoleFooter package
 */

export interface TreeConsoleFooterController {
  /**
   * Current row selection state
   */
  rowSelection?: Record<string, boolean>;

  /**
   * Current search text
   */
  searchText?: string;

  /**
   * Number of items after filtering
   */
  filteredItemCount?: number;

  /**
   * Total number of items before filtering
   */
  totalItemCount?: number;

  /**
   * Data array (fallback for counts)
   */
  data?: any[];
}

export interface TreeConsoleFooterProps {
  /**
   * Controller providing data for footer statistics
   */
  controller?: TreeConsoleFooterController | null;

  /**
   * Height of the footer in pixels
   */
  height?: number;

  /**
   * Callback when guided tour is requested
   */
  onStartTour?: () => void;

  /**
   * Show tour button
   */
  showTour?: boolean;

  /**
   * Custom statistics text (overrides controller-based calculation)
   */
  customText?: string;

  /**
   * Position variant
   */
  position?: 'relative' | 'absolute' | 'fixed';
}
