/**
 * Ensure React Refresh globals exist when the worker bundle evaluates files transformed
 * by react-refresh/babel. In dev mode Vite injects calls to $RefreshSig$/$RefreshReg$
 * before the React Router runtime has a chance to run, so we install safe no-ops here.
 */

if (import.meta.env.DEV && typeof globalThis !== 'undefined') {
  const globalRef = globalThis as typeof globalThis & {
    $RefreshReg$?: (type: unknown, id?: string) => unknown;
    $RefreshSig$?: () => (type: unknown) => unknown;
    __vite_plugin_react_preamble_installed__?: boolean;
  };

  if (typeof globalRef.$RefreshReg$ !== 'function') {
    globalRef.$RefreshReg$ = () => {};
  }
  if (typeof globalRef.$RefreshSig$ !== 'function') {
    globalRef.$RefreshSig$ = () => (type) => type;
  }
  if (!globalRef.__vite_plugin_react_preamble_installed__) {
    globalRef.__vite_plugin_react_preamble_installed__ = true;
  }
}
