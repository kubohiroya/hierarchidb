import 'i18next';

declare module 'i18next' {
  interface InterpolationOptions {
    formatters?: Record<
      string,
      (value: unknown, lng?: string, options?: unknown) => string | unknown
    >;
  }
}
