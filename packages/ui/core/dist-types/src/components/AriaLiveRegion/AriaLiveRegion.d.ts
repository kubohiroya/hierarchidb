/**
 * @file AriaLiveRegion.tsx
 * @description Global aria-live region for screen reader announcements
 * @module components/ui/AriaLiveRegion
 */
export type AriaLiveMode = 'polite' | 'assertive';
/**
 * Add a message to the aria-live region
 * @param message - The message to announce
 * @param mode - The aria-live mode ('polite' or 'assertive')
 */
export declare function announceToScreenReader(message: string, mode?: AriaLiveMode): void;
/**
 * AriaLiveRegion component that provides screen reader announcements
 *
 * @example
 * ```tsx
 * // Add to your src root
 * <AriaLiveRegion />
 *
 * // Use from anywhere in your src
 * announceToScreenReader('File uploaded successfully');
 * announceToScreenReader('Error: Invalid file format', 'assertive');
 * ```
 */
export declare function AriaLiveRegion(): JSX.Element;
//# sourceMappingURL=AriaLiveRegion.d.ts.map