declare module 'react-router-dom' {
  import type { ComponentType } from 'react';
  // Minimal shim for build-time typing within this package only.
  // At runtime, the host app must provide react-router-dom.
  export const Link: ComponentType<any>;
}

