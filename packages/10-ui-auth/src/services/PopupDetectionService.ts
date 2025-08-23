/**
 * @file PopupDetectionService.ts
 * @description Service to detect popup capability and manage auth method fallback
 */

// import { devLog, devWarn } from '@/shared/utils/logger';
const devLog = (msg: string, data?: any) => console.log(msg, data);
const devWarn = (msg: string, data?: any) => console.warn(msg, data);

const POPUP_CAPABILITY_KEY = 'eria-popup-capability';
const POPUP_TEST_TIMEOUT = 2000; // 2 seconds

export type PopupCapability = 'supported' | 'blocked' | 'unknown';

export class PopupDetectionService {
  private static instance: PopupDetectionService;
  private capability: PopupCapability = 'unknown';

  private constructor() {
    this.loadCapability();
  }

  static getInstance(): PopupDetectionService {
    if (!this.instance) {
      this.instance = new PopupDetectionService();
    }
    return this.instance;
  }

  /**
   * Load popup capability from localStorage
   */
  private loadCapability(): void {
    const stored = localStorage.getItem(POPUP_CAPABILITY_KEY);
    if (stored === 'supported' || stored === 'blocked') {
      this.capability = stored;
      devLog(`Loaded popup capability: ${stored}`);
    }
  }

  /**
   * Save popup capability to localStorage
   */
  saveCapability(capability: PopupCapability): void {
    this.capability = capability;
    if (capability !== 'unknown') {
      localStorage.setItem(POPUP_CAPABILITY_KEY, capability);
    }
  }

  /**
   * Update popup capability (public method)
   */
  updateCapability(capability: PopupCapability): void {
    this.saveCapability(capability);
  }

  /**
   * Get current popup capability
   */
  getCapability(): PopupCapability {
    return this.capability;
  }

  /**
   * Test if popups are supported
   */
  async testPopupCapability(): Promise<PopupCapability> {
    // If already tested and confirmed blocked, don't test again
    if (this.capability === 'blocked') {
      return 'blocked';
    }

    return new Promise((resolve) => {
      try {
        // Try to open a small test popup with data URL to avoid CORS issues
        const testUrl = 'data:text/html,<html><body><script>window.close();</script></body></html>';
        const popup = window.open(
          testUrl,
          'popup-test',
          'width=100,height=100,left=-1000,top=-1000'
        );

        if (!popup) {
          // Popup was blocked
          devWarn('Popup blocked by browser');
          this.saveCapability('blocked');
          resolve('blocked');
          return;
        }

        // Test for COOP restrictions
        let hasCOOPIssue = false;
        try {
          // Try to access popup.closed - this will throw in COOP environments
          const canAccessClosed = popup.closed !== undefined;
          if (!canAccessClosed) {
            hasCOOPIssue = true;
          }
        } catch (e) {
          // COOP error detected
          devWarn('COOP restrictions detected:', e);
          hasCOOPIssue = true;
        }

        if (hasCOOPIssue) {
          // Can't control popup due to COOP
          try {
            popup.close();
          } catch (error) {
            // Ignore error when closing popup
          }
          this.saveCapability('blocked');
          resolve('blocked');
          return;
        }

        // Set a timeout to check if popup is still open
        const checkInterval = setInterval(() => {
          try {
            if (popup.closed) {
              // User closed the popup quickly, but it was opened successfully
              clearInterval(checkInterval);
              clearTimeout(timeout);
              this.saveCapability('supported');
              resolve('supported');
            }
          } catch (e) {
            // Cross-origin error, popup is likely blocked
            clearInterval(checkInterval);
            clearTimeout(timeout);
            this.saveCapability('blocked');
            resolve('blocked');
          }
        }, 100);

        // Timeout to close test popup
        const timeout = setTimeout(() => {
          clearInterval(checkInterval);
          try {
            if (!popup.closed) {
              popup.close();
            }
            // Popup worked
            this.saveCapability('supported');
            resolve('supported');
          } catch (e) {
            // Error closing, probably blocked
            this.saveCapability('blocked');
            resolve('blocked');
          }
        }, POPUP_TEST_TIMEOUT);
      } catch (error) {
        // Any error means popups are blocked
        devWarn('Popup test failed:', error);
        this.saveCapability('blocked');
        resolve('blocked');
      }
    });
  }

  /**
   * Check if environment might block popups
   */
  isPotentiallyBlocked(): boolean {
    // Check for common popup-blocking scenarios
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIframe = window !== window.top;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    return isMobile || isIframe || (isSafari && this.capability !== 'supported');
  }

  /**
   * Clear stored capability (useful for retesting)
   */
  clearCapability(): void {
    this.capability = 'unknown';
    localStorage.removeItem(POPUP_CAPABILITY_KEY);
  }
}
