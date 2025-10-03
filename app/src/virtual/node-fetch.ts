export const Headers = globalThis.Headers ?? class Headers {};
export const Request = globalThis.Request ?? class Request {};
export const Response = globalThis.Response ?? class Response {};
export const FormData = globalThis.FormData ?? class FormData {};

export const fallbackFetch: typeof globalThis.fetch = (...args) => {
  if (typeof globalThis.fetch === 'function') {
    return (globalThis.fetch as typeof globalThis.fetch)(...args);
  }
  throw new Error('fetch is not available in this test environment');
};
