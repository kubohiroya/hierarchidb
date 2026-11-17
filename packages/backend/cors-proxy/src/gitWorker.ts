import type { RawEnv } from '~/env-mapper';
import { handleGitHubApi, isGitHubApiPath } from './handleGitHubApi';
import { handleGitProxy, isGitProxyPath } from './handleGitProxy';

// The Git Worker serves only the TurboWarp Plus Editor routes under `/v1/git/` and `/v1/github/`.
// It runs apart from the generic `?url=` proxy in `worker.ts`, so the two keep their own origins,
// configuration and deployments.
export default {
  async fetch(request: Request, env: RawEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (isGitProxyPath(pathname)) return handleGitProxy(request, env);
    if (isGitHubApiPath(pathname)) return handleGitHubApi(request, env);
    return Response.json(
      { code: 'NOT_FOUND', requestId: crypto.randomUUID() },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  },
};
