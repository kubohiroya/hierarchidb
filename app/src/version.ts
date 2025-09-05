// Build-time injected constants (see vite.config.ts define)
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

export const APP_VERSION: string = (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev');
export const BUILD_TIME: string = (typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString());

