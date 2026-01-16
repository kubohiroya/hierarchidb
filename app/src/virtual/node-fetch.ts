import nodeFetch, { Headers, Request, Response, FormData } from 'node-fetch';

const fetchImpl: typeof globalThis.fetch = ((input, init) => {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch(input, init);
  }
  return (nodeFetch as unknown as typeof globalThis.fetch)(input, init);
}) as typeof globalThis.fetch;

export default fetchImpl;
const FetchHeaders = Headers ?? globalThis.Headers;
const FetchRequest = Request ?? globalThis.Request;
const FetchResponse = Response ?? globalThis.Response;
const FetchFormData = FormData ?? globalThis.FormData;

export { FetchHeaders as Headers, FetchRequest as Request, FetchResponse as Response, FetchFormData as FormData };
