import nodeFetch, {
  Request as NodeRequest,
  Response as NodeResponse,
  FormData as NodeFormData,
  Headers as NodeHeaders,
} from 'node-fetch';

type GlobalFetch = NonNullable<typeof globalThis.fetch>;
type FetchInput = Parameters<GlobalFetch>[0];
type FetchInit = Parameters<GlobalFetch>[1];
type GlobalResponse = Awaited<ReturnType<GlobalFetch>>;
type NodeResponseType = Awaited<ReturnType<typeof nodeFetch>>;
type FetchResponse = GlobalResponse | NodeResponseType;
type NodeFetchInit = Parameters<typeof nodeFetch>[1];

const fetchImpl = async (
  input: FetchInput,
  init?: FetchInit
): Promise<FetchResponse> => {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch(input, init);
  }
  const normalized = init ? toNodeFetchInit(init) : undefined;
  return nodeFetch(input as string | URL | NodeRequest, normalized);
};

const toNodeFetchInit = (init: FetchInit): NodeFetchInit => {
  if (!init || !('body' in init) || init.body === null || init.body === undefined) {
    return init as NodeFetchInit;
  }
  if (init.body instanceof ArrayBuffer) {
    return {
      ...init,
      body: Buffer.from(init.body),
    } as NodeFetchInit;
  }
  if (init.body instanceof Uint8Array) {
    return {
      ...init,
      body: Buffer.from(init.body),
    } as NodeFetchInit;
  }
  return init as NodeFetchInit;
};

export default fetchImpl;
const FetchHeaders = NodeHeaders ?? globalThis.Headers;
const FetchRequest = NodeRequest ?? globalThis.Request;
const FetchResponseClass = NodeResponse ?? globalThis.Response;
const FetchFormData = NodeFormData ?? globalThis.FormData;

export {
  FetchHeaders as Headers,
  FetchRequest as Request,
  FetchResponseClass as Response,
  FetchFormData as FormData,
};
