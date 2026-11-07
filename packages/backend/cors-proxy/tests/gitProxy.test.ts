import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGitProxy } from '../src/handleGitProxy';

const origin = 'tw-editor://.';
const host = 'https://git.example.test';
const root = host + '/v1/git/owner/project.git';
const discovery = root + '/info/refs?service=git-upload-pack';
const upload = root + '/git-upload-pack';
const bearer = 'Bearer ' + 'a'.repeat(43) + '.' + 'b'.repeat(43);
const bytes = Uint8Array.of(0, 12, 255);

function fixture() {
  const resolve = vi.fn(async (_url: string, init: RequestInit) => {
    const grant = JSON.parse(String(init.body));
    if (grant.credential !== 'b'.repeat(43))
      return Response.json({ code: 'SESSION_REQUIRED' }, { status: 401 });
    if (grant.write) return Response.json({ code: 'FORBIDDEN' }, { status: 403 });
    if (grant.candidate?.repo === 'other')
      return Response.json({ code: 'REDIRECT_REJECTED' }, { status: 409 });
    return Response.json({
      owner: 'owner',
      repo: grant.candidate?.repo ?? 'project',
      accessToken: 'ghu_private',
    });
  });
  const env = {
    GIT_PROXY_ORIGIN: host,
    GIT_ALLOWED_ORIGINS: origin + ',https://editor.example.test',
    GIT_SESSIONS: {
      idFromName: (name: string) => name,
      get: () => ({ fetch: resolve }),
    } as unknown as DurableObjectNamespace,
  };
  const send = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.body)
      expect(new Uint8Array(await new Response(init.body).arrayBuffer())).toEqual(bytes);
    return new Response(bytes, {
      headers: {
        'Content-Type': new Headers(init?.headers).get('Accept') ?? '',
        'Set-Cookie': 'unsafe=ignored',
      },
    });
  });
  const call = (url = discovery, { headers, ...init }: RequestInit = {}, allowedOrigin = origin) =>
    handleGitProxy(
      new Request(url, { ...init, headers: { Origin: allowedOrigin, ...headers } }),
      env,
      send as typeof fetch
    );
  return { env, call, resolve, send };
}

beforeEach(() => {
  vi.stubGlobal(
    'FixedLengthStream',
    class extends TransformStream {
      constructor(_length: number) {
        super();
      }
    }
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Git Smart HTTP Worker', () => {
  it('accepts Desktop GET and POST preflights without invoking auth', async () => {
    const { call, resolve, send } = fixture();
    for (const [url, method, requested] of [
      [discovery, 'GET', 'authorization'],
      [upload, 'POST', 'authorization, content-type'],
    ]) {
      const response = await call(url, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': method,
          'Access-Control-Request-Headers': requested,
        },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(method);
      expect(response.headers.get('Vary')).toContain('Access-Control-Request-Headers');
    }
    expect(resolve).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('streams authenticated GET and POST and builds a separate GitHub Authorization header', async () => {
    const { call, send } = fixture();
    const Authorization = bearer;
    const get = await call(discovery, {
      headers: { Authorization, Cookie: 'leak=token', Referer: 'https://editor.example.test' },
    });
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(bytes);
    expect(get.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(get.headers.has('Set-Cookie')).toBe(false);
    const post = await call(upload, {
      method: 'POST',
      headers: {
        Authorization,
        'Content-Length': String(bytes.byteLength),
        'Content-Type': 'application/x-git-upload-pack-request',
      },
      body: bytes,
    });
    expect(new Uint8Array(await post.arrayBuffer())).toEqual(bytes);
    for (const [url, init] of send.mock.calls) {
      expect(url).toMatch(/^https:\/\/github\.com\/owner\/project\.git\//u);
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe('Basic ' + btoa('x-access-token:ghu_private'));
      for (const name of ['Cookie', 'Referer', 'Origin', 'Host'])
        expect(headers.has(name)).toBe(false);
      expect(init?.redirect).toBe('manual');
    }
  });

  it('rejects untrusted origins, targets, bearer and size without contacting upstream Git', async () => {
    const { call, send } = fixture();
    for (const value of ['', 'null', '*', 'tw-editor://./', 'https://evil.test']) {
      const response = await call(discovery, { headers: { Authorization: bearer } }, value);
      expect(response.status).toBe(403);
      expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
    }
    expect((await call(discovery + '&url=https://evil.test')).status).toBe(400);
    expect((await call(discovery.replace(host, 'https://spoof.test'))).status).toBe(403);
    const unauthorized = await call();
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(
      (await call(discovery, { headers: { Authorization: bearer.replace(/b+/u, 'x'.repeat(43)) } }))
        .status
    ).toBe(401);
    expect(
      (
        await call(root + '/info/refs?service=git-receive-pack', {
          headers: { Authorization: bearer },
        })
      ).status
    ).toBe(403);
    const headers = {
      Authorization: bearer,
      'Content-Type': 'application/x-git-upload-pack-request',
    };
    expect((await call(upload, { method: 'POST', headers, body: bytes })).status).toBe(411);
    expect(
      (
        await call(upload, {
          method: 'POST',
          headers: { ...headers, 'Content-Length': String(32 * 1024 * 1024 + 1) },
          body: bytes,
        })
      ).status
    ).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects disallowed redirects and follows one verified same-repository discovery', async () => {
    const { call, send } = fixture();
    const headers = { Authorization: bearer };
    for (const location of [
      'https://evil.test/owner/project.git/info/refs?service=git-upload-pack',
      'https://github.com/owner/other.git/info/refs?service=git-upload-pack',
    ]) {
      send.mockResolvedValueOnce(
        new Response(null, { status: 307, headers: { Location: location } })
      );
      expect((await call(discovery, { headers })).status).toBe(409);
    }
    send.mockResolvedValueOnce(
      new Response(null, {
        status: 307,
        headers: {
          Location: 'https://github.com/owner/renamed.git/info/refs?service=git-upload-pack',
        },
      })
    );
    expect((await call(discovery, { headers })).status).toBe(200);
    expect(send.mock.calls.at(-1)?.[0]).toContain('/owner/renamed.git/');
    send.mockResolvedValueOnce(
      new Response(null, {
        status: 307,
        headers: {
          Location: 'https://github.com/owner/renamed.git/git-upload-pack',
        },
      })
    );
    expect(
      (
        await call(upload, {
          method: 'POST',
          body: bytes,
          headers: {
            ...headers,
            'Content-Type': 'application/x-git-upload-pack-request',
            'Content-Length': '3',
          },
        })
      ).status
    ).toBe(409);
    expect(send).toHaveBeenCalledTimes(5);
  });
});
