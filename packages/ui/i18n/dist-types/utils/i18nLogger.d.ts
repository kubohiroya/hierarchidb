/**
 * @file i18nLogger.ts
 * @description Internationalized logging utilities that work with i18next
 *
 * This utility extends the existing logger to support internationalized messages
 * for both console output and development feedback.
 */
/**
 * Type for i18next interpolation options
 */
export interface I18nInterpolationOptions {
    [key: string]: string | number | boolean | Date | undefined;
}
export declare const i18nLog: (key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => void;
export declare const i18nWarn: (key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => void;
export declare const i18nError: (key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => void;
export declare const i18nInfo: (key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => void;
export declare const i18nDebug: (key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => void;
export declare const i18nGroup: ((..._args: unknown[]) => void) | ((key: string, options?: I18nInterpolationOptions) => void);
export declare const i18nGroupCollapsed: ((..._args: unknown[]) => void) | ((key: string, options?: I18nInterpolationOptions) => void);
export declare const i18nGroupEnd: () => void;
export declare const i18nTime: ((..._args: unknown[]) => void) | ((key: string, options?: I18nInterpolationOptions) => void);
export declare const i18nTimeEnd: ((..._args: unknown[]) => void) | ((key: string, options?: I18nInterpolationOptions) => void);
export declare const i18nPerf: (labelKey: string, fn: () => void, options?: I18nInterpolationOptions) => void;
export declare const i18nPerfAsync: <T>(labelKey: string, fn: () => Promise<T>, options?: I18nInterpolationOptions) => Promise<T>;
export declare const i18nLifecycle: (componentName: string, phaseKey: string, data?: unknown) => void;
export declare const i18nAssert: (condition: boolean, messageKey: string, options?: I18nInterpolationOptions, ...args: unknown[]) => void;
export declare const i18nFeature: (featureName: string, enabled: boolean, ...args: unknown[]) => void;
export declare const i18nAPI: {
    request: (url: string, options?: unknown) => void;
    response: (url: string, status: number, data?: unknown) => void;
    error: (url: string, error: unknown) => void;
};
export declare const i18nLogIf: (condition: boolean, key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => void;
export declare const i18nWarnIf: (condition: boolean, key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => void;
export declare const i18nErrorIf: (condition: boolean, key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => void;
//# sourceMappingURL=i18nLogger.d.ts.map