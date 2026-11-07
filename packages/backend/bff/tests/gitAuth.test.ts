import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/index';
import { GitSession, type GitAuthEnv } from '../src/GitSession';

const bff = 'https://bff.example.test';
const editor = 'tw-editor://.';
const github = 'https://github.com/owner/project.git';
const proxy = 'https://git.example.test';

function fixture() {
  const records = new Map<string, unknown>();
  const instances = new Map<string, GitSession>();
  const env = {
    GIT_ALLOWED_ORIGINS: editor + ',https://editor.example.test',
    GIT_PROXY_ORIGIN: proxy,
    GIT_GITHUB_CLIENT_ID: 'app',
    GIT_GITHUB_CLIENT_SECRET: 'fixture',
    GIT_GITHUB_REDIRECT_URI: bff + '/v1/git-auth/callback',
    GIT_SESSION_KEY: 'a'.repeat(64),
  } as GitAuthEnv;
  env.GIT_SESSIONS = {
    idFromName: (name: string) => name,
    get: (name: string) => {
      let object = instances.get(name);
      if (!object) {
        const storage = {
          get: async (key: string) => structuredClone(records.get(name + key)),
          put: async (key: string, value: unknown) => {
            records.set(name + key, structuredClone(value));
          },
          delete: async (key: string) => records.delete(name + key),
          setAlarm: async () => {},
          transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(storage),
        };
        object = new GitSession({ storage } as unknown as DurableObjectState, env);
        instances.set(name, object);
      }
      const instance = object;
      return { fetch: (url: string, init: RequestInit) => instance.fetch(new Request(url, init)) };
    },
  } as unknown as DurableObjectNamespace;
  const send = vi.fn(async (input: string, init?: RequestInit) => {
    if (input === 'https://github.com/login/oauth/access_token') {
      expect(init?.redirect).toBe('manual');
      const body = init?.body as URLSearchParams;
      expect(body.get('client_secret')).toBe('fixture');
      expect(body.has('code_verifier') || body.get('grant_type') === 'refresh_token').toBe(true);
      return Response.json({
        access_token: 'ghu_private',
        refresh_token: 'ghr_private',
        expires_in: 60,
        refresh_token_expires_in: 7200,
      });
    }
    if (input.endsWith('/user')) return Response.json({ login: 'fixture-user' });
    if (input.endsWith('/owner/project'))
      return Response.json({
        id: 42,
        full_name: 'owner/project',
        permissions: { pull: true, push: true },
      });
    if (input.endsWith('/owner/renamed'))
      return Response.json({
        id: 42,
        full_name: 'owner/renamed',
        permissions: { pull: true, push: true },
      });
    if (input.endsWith('/owner/other'))
      return Response.json({
        id: 43,
        full_name: 'owner/other',
        permissions: { pull: true, push: true },
      });
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', send);
  const call = (path: string, init: RequestInit = {}, origin = editor) =>
    app.request(
      bff + '/v1/git-auth' + path,
      { ...init, headers: { Origin: origin, ...init.headers } },
      env as never
    );
  return { env, call, send, records };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('GitHub App BFF session', () => {
  it('consumes OAuth state once, encrypts provider credentials, scopes the lease and revokes it', async () => {
    const { env, call, records, send } = fixture();
    const start = await call('/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remote: github, write: false }),
    });
    expect(start.status).toBe(200);
    expect(start.headers.get('Access-Control-Allow-Origin')).toBe(editor);
    const { authorizationUrl, ticket } = await start.json();
    const url = new URL(authorizationUrl);
    const state = url.searchParams.get('state');
    expect(url.hostname).toBe('github.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const headers = { Authorization: 'Bearer ' + ticket };
    expect((await call('/session', { headers })).status).toBe(202);
    expect((await call('/callback?code=fixture-code&state=' + state)).status).toBe(200);
    expect((await call('/callback?code=fixture-code&state=' + state)).status).toBe(400);
    expect(send.mock.calls.filter(([url]) => url.includes('/oauth/access_token'))).toHaveLength(1);
    const response = await call('/session', { headers });
    const result = await response.json();
    expect(result).toMatchObject({
      connection: { mode: 'cloudflare', proxyOrigin: proxy },
      account: { login: 'fixture-user' },
    });
    expect(result.bearer).not.toBe(ticket);
    expect(JSON.stringify(result)).not.toContain('ghu_private');
    expect(JSON.stringify([...records])).not.toMatch(/gh[ur]_private/u);
    expect((await call('/session', { headers }, 'https://editor.example.test')).status).toBe(401);

    if (!state || !env.GIT_SESSIONS) throw new Error('missing fixture state');
    const stub = env.GIT_SESSIONS.get(env.GIT_SESSIONS.idFromName(state));
    const grant = (patch = {}) =>
      stub.fetch('https://git-session.internal/authorize', {
        method: 'POST',
        body: JSON.stringify({
          credential: result.bearer.split('.')[1],
          origin: editor,
          owner: 'owner',
          repo: 'project',
          write: false,
          ...patch,
        }),
      });
    expect((await grant({ write: true })).status).toBe(403);
    expect((await grant({ repo: 'other' })).status).toBe(403);
    expect((await grant({ candidate: { owner: 'owner', repo: 'other' } })).status).toBe(409);
    expect(await (await grant({ candidate: { owner: 'owner', repo: 'renamed' } })).json()).toEqual({
      owner: 'owner',
      repo: 'renamed',
      accessToken: 'ghu_private',
    });
    expect(await (await grant()).json()).toMatchObject({ repo: 'renamed' });
    expect((await call('/session', { method: 'DELETE', headers })).status).toBe(204);
    expect((await grant()).status).toBe(401);
    expect(records.size).toBe(0);
  });

  it('refreshes provider credentials and replaces an expired proxy bearer', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-07T00:00:00Z'));
    const { env, call, send } = fixture();
    const start = await call('/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remote: github, write: false }),
    });
    const { authorizationUrl, ticket } = await start.json();
    const state = new URL(authorizationUrl).searchParams.get('state');
    if (!state || !env.GIT_SESSIONS) throw new Error('missing fixture state');
    expect((await call('/callback?code=fixture-code&state=' + state)).status).toBe(200);
    const headers = { Authorization: 'Bearer ' + ticket };
    const { bearer } = await (await call('/session', { headers })).json();
    const stub = env.GIT_SESSIONS.get(env.GIT_SESSIONS.idFromName(state));
    const grant = (token: string) =>
      stub.fetch('https://git-session.internal/authorize', {
        method: 'POST',
        body: JSON.stringify({
          credential: token.split('.')[1],
          origin: editor,
          owner: 'owner',
          repo: 'project',
          write: false,
        }),
      });
    vi.setSystemTime(new Date('2026-11-07T00:01:01Z'));
    expect((await grant(bearer)).status).toBe(200);
    expect(
      send.mock.calls.filter(
        ([url, options]) =>
          url.includes('/oauth/access_token') &&
          (options?.body as URLSearchParams).get('grant_type') === 'refresh_token'
      )
    ).toHaveLength(1);
    vi.setSystemTime(new Date('2026-11-07T00:05:01Z'));
    expect((await grant(bearer)).status).toBe(401);
    const renewed = await (await call('/session', { headers })).json();
    expect(renewed.bearer).not.toBe(bearer);
    expect((await grant(renewed.bearer)).status).toBe(200);
  });

  it('rejects spoofed origins and invalid repository URLs before contacting GitHub', async () => {
    const { call, send } = fixture();
    for (const origin of ['null', '*', 'tw-editor://./', 'https://evil.test']) {
      const response = await call(
        '/start',
        { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST' } },
        origin
      );
      expect(response.status).toBe(403);
      expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
    }
    const response = await call('/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remote: 'https://user@github.com/owner/project', write: true }),
    });
    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
});
