// Local ambient shims for browser-targeted package without Node types

declare const process: {
  env: Record<string, string | undefined>;
};

declare namespace NodeJS {
  // In browsers, timers return number; alias to keep code compiling
  type Timeout = number;
}

