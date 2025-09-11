// Ambient UI type declarations shared across packages
// Centralizing these avoids per-package local shims that dep-fence flags.

// CSS Modules (e.g., *.module.css)
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// MapLibre CSS import module
declare module 'maplibre-gl/dist/maplibre-gl.css';

