import { decrypt, encrypt } from '~/utils/encryption';
import { generateCodeVerifier } from '~/utils/pkce';

export type GitAuthEnv = {
  GIT_SESSIONS?: DurableObjectNamespace;
  GIT_ALLOWED_ORIGINS?: string;
  GIT_PROXY_ORIGIN?: string;
  GIT_GITHUB_CLIENT_ID?: string;
  GIT_GITHUB_CLIENT_SECRET?: string;
  GIT_GITHUB_REDIRECT_URI?: string;
  GIT_SESSION_KEY?: string;
};

type Settings = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  proxyOrigin: string;
  key: string;
};
type Repository = { owner: string; repo: string };
type Pending = {
  phase: 'pending' | 'exchanging' | 'failed';
  state: string;
  verifier: string;
  ticketHash: string;
  origin: string;
  remote: Repository;
  write: boolean;
  deadline: number;
};
type Active = {
  phase: 'active';
  origin: string;
  remote: Repository;
  write: boolean;
  ticketHash: string;
  canonical: Repository & { id: number };
  account: { login: string };
  deadline: number;
  expiresAt: number;
  credentials: string;
};
type Record = Pending | Active;
type Credentials = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  proxySecret: string;
};

const keyPattern = /^[A-Za-z0-9_-]{43}$/u;
const tokenPattern = /^[A-Za-z0-9_]+$/u;
const ownerPattern = /^[A-Za-z0-9][A-Za-z0-9-]*$/u;
const repoPattern = /^[A-Za-z0-9_.-]+$/u;
const recordKey = 'session';
const shortSession = 5 * 60_000;

export class GitAuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
  }
}

export function getGitAuthSettings(env: GitAuthEnv): Settings | null {
  const {
    GIT_GITHUB_CLIENT_ID: clientId,
    GIT_GITHUB_CLIENT_SECRET: clientSecret,
    GIT_GITHUB_REDIRECT_URI: redirectUri,
    GIT_PROXY_ORIGIN: proxyOrigin,
    GIT_SESSION_KEY: key,
  } = env;
  if (
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !proxyOrigin ||
    !key ||
    !/^[a-f0-9]{64}$/iu.test(key)
  )
    return null;
  try {
    const callback = new URL(redirectUri);
    const proxy = new URL(proxyOrigin);
    if (
      callback.protocol !== 'https:' ||
      callback.pathname !== '/v1/git-auth/callback' ||
      redirectUri !== callback.origin + callback.pathname ||
      proxy.protocol !== 'https:' ||
      proxy.origin !== proxyOrigin
    )
      return null;
  } catch {
    return null;
  }
  return { clientId, clientSecret, redirectUri, proxyOrigin, key };
}

function validRepository(owner: unknown, repo: unknown): owner is string {
  return (
    typeof owner === 'string' &&
    ownerPattern.test(owner) &&
    typeof repo === 'string' &&
    repoPattern.test(repo) &&
    !['.', '..', '.git'].includes(repo.toLowerCase())
  );
}

export function parseGitRemote(value: unknown): Repository | null {
  if (typeof value !== 'string') return null;
  const match =
    /^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9-]*)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/u.exec(
      value
    );
  return match && match[0] === value && match[1] && match[2] && validRepository(match[1], match[2])
    ? { owner: match[1], repo: match[2] }
    : null;
}

export async function hashGitTicket(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, '0')).join('');
}

function sameRepository(a: Repository, b: Repository): boolean {
  return (
    a.owner.toLowerCase() === b.owner.toLowerCase() && a.repo.toLowerCase() === b.repo.toLowerCase()
  );
}

function gitError(status: number, code: string): never {
  throw new GitAuthError(status, code);
}

export class GitSession {
  private key: Promise<CryptoKey> | undefined;
  private refreshing: Promise<Credentials> | undefined;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: GitAuthEnv
  ) {}

  async fetch(request: Request): Promise<Response> {
    const config = getGitAuthSettings(this.env);
    if (!config || request.method !== 'POST')
      return Response.json({ code: 'GIT_AUTH_UNAVAILABLE' }, { status: 404 });
    try {
      const path = new URL(request.url).pathname;
      if (path === '/start') {
        const pending = await request.json<Pending>();
        await this.state.storage.setAlarm(pending.deadline);
        await this.state.storage.put(recordKey, pending);
        return new Response(null, { status: 204 });
      }
      if (path === '/callback') {
        const { code, state } = await request.json<{ code: string; state: string }>();
        await this.complete(state, code, config);
        return new Response(null, { status: 204 });
      }
      if (path === '/session' || path === '/revoke') {
        const { credential, origin, state } = await request.json<{
          credential: string;
          origin: string;
          state: string;
        }>();
        const record = await this.state.storage.get<Record>(recordKey);
        if (
          !record ||
          record.origin !== origin ||
          record.ticketHash !== (await hashGitTicket(credential))
        ) {
          return gitError(401, 'SESSION_REQUIRED');
        }
        if (path === '/revoke') {
          await this.state.storage.delete(recordKey);
          return new Response(null, { status: 204 });
        }
        if (record.deadline <= Date.now()) return gitError(401, 'SESSION_EXPIRED');
        if (record.phase === 'failed') return gitError(401, 'REAUTH_REQUIRED');
        if (record.phase !== 'active') return new Response(null, { status: 202 });
        const { credentials, expiresAt } = await this.lease(record, config);
        return Response.json({
          connection: { mode: 'cloudflare', proxyOrigin: config.proxyOrigin },
          account: record.account,
          bearer: state + '.' + credentials.proxySecret,
          expiresAt,
        });
      }
      if (path === '/authorize') {
        const value = await request.json<
          Repository & {
            credential: string;
            origin: string;
            write: boolean;
            candidate?: Repository;
          }
        >();
        return Response.json(await this.authorize(value, config));
      }
      return Response.json({ code: 'BAD_REQUEST' }, { status: 400 });
    } catch (error) {
      return error instanceof GitAuthError
        ? Response.json({ code: error.code }, { status: error.status })
        : Response.json({ code: 'UPSTREAM_FAILURE' }, { status: 502 });
    }
  }

  async alarm(): Promise<void> {
    const record = await this.state.storage.get<Record>(recordKey);
    if (record && record.deadline <= Date.now()) await this.state.storage.delete(recordKey);
  }

  private async complete(state: string, code: string, config: Settings): Promise<void> {
    const pending = await this.state.storage.transaction(async (tx) => {
      const current = await tx.get<Record>(recordKey);
      if (
        !current ||
        current.phase !== 'pending' ||
        current.state !== state ||
        current.deadline <= Date.now()
      ) {
        return gitError(400, 'INVALID_OAUTH_STATE');
      }
      await tx.put(recordKey, { ...current, phase: 'exchanging' });
      return current;
    });
    try {
      const tokens = await this.exchange(
        { code, redirect_uri: config.redirectUri, code_verifier: pending.verifier },
        config
      );
      const user = await this.github('/user', tokens.accessToken);
      if (typeof user.login !== 'string' || !user.login) return gitError(401, 'REAUTH_REQUIRED');
      const login = user.login;
      const canonical = await this.lookup(pending.remote, pending.write, tokens.accessToken);
      const deadline = Math.min(tokens.refreshExpiresAt, Date.now() + 8 * 60 * 60_000);
      const expiresAt = Math.min(deadline, Date.now() + shortSession);
      const credentials = await encrypt(
        JSON.stringify({ ...tokens, proxySecret: generateCodeVerifier() }),
        await this.encryptionKey(config)
      );
      await this.state.storage.transaction(async (tx) => {
        const current = await tx.get<Record>(recordKey);
        if (current?.phase !== 'exchanging') return gitError(401, 'SESSION_REQUIRED');
        await tx.setAlarm(deadline);
        await tx.put<Active>(recordKey, {
          phase: 'active',
          origin: pending.origin,
          remote: pending.remote,
          ticketHash: pending.ticketHash,
          write: pending.write,
          canonical,
          account: { login },
          deadline,
          expiresAt,
          credentials,
        });
      });
    } catch (error) {
      await this.state.storage.transaction(async (tx) => {
        const current = await tx.get<Record>(recordKey);
        if (current?.phase === 'exchanging')
          await tx.put(recordKey, { ...current, phase: 'failed' });
      });
      throw error;
    }
  }

  private async lease(
    record: Active,
    config: Settings
  ): Promise<{ credentials: Credentials; expiresAt: number }> {
    const current = await this.readCredentials(record, config);
    if (record.expiresAt > Date.now()) return { credentials: current, expiresAt: record.expiresAt };
    return this.state.storage.transaction(async (tx) => {
      const latest = await tx.get<Record>(recordKey);
      if (latest?.phase !== 'active' || latest.deadline <= Date.now())
        return gitError(401, 'SESSION_EXPIRED');
      const credentials = await this.readCredentials(latest, config);
      if (latest.expiresAt > Date.now()) return { credentials, expiresAt: latest.expiresAt };
      credentials.proxySecret = generateCodeVerifier();
      const expiresAt = Math.min(latest.deadline, Date.now() + shortSession);
      await tx.put(recordKey, {
        ...latest,
        expiresAt,
        credentials: await encrypt(JSON.stringify(credentials), await this.encryptionKey(config)),
      });
      return { credentials, expiresAt };
    });
  }

  private async authorize(
    value: Repository & {
      credential: string;
      origin: string;
      write: boolean;
      candidate?: Repository;
    },
    config: Settings
  ) {
    const record = await this.state.storage.get<Record>(recordKey);
    if (
      !record ||
      record.phase !== 'active' ||
      record.origin !== value.origin ||
      !keyPattern.test(value.credential)
    )
      return gitError(401, 'SESSION_REQUIRED');
    const credentials = await this.readCredentials(record, config);
    if (credentials.proxySecret !== value.credential) return gitError(401, 'SESSION_REQUIRED');
    if (record.expiresAt <= Date.now()) return gitError(401, 'SESSION_EXPIRED');
    if (!sameRepository(value, record.remote) || (value.write && !record.write))
      return gitError(403, 'FORBIDDEN');

    const usable =
      credentials.accessExpiresAt > Date.now()
        ? credentials
        : await this.refresh(credentials, config);
    let target;
    try {
      target = await this.lookup(
        value.candidate ?? record.canonical,
        value.write,
        usable.accessToken
      );
    } catch (error) {
      if (value.candidate && error instanceof GitAuthError && error.status === 403)
        return gitError(409, 'REDIRECT_REJECTED');
      throw error;
    }
    if (target.id !== record.canonical.id)
      return gitError(
        value.candidate ? 409 : 403,
        value.candidate ? 'REDIRECT_REJECTED' : 'FORBIDDEN'
      );
    await this.state.storage.transaction(async (tx) => {
      const latest = await tx.get<Record>(recordKey);
      if (latest?.phase !== 'active') return gitError(401, 'SESSION_REQUIRED');
      if (latest.expiresAt <= Date.now()) return gitError(401, 'SESSION_EXPIRED');
      if ((await this.readCredentials(latest, config)).proxySecret !== value.credential)
        return gitError(401, 'SESSION_REQUIRED');
      if (value.candidate) await tx.put(recordKey, { ...latest, canonical: target });
    });
    return { owner: target.owner, repo: target.repo, accessToken: usable.accessToken };
  }

  private refresh(credentials: Credentials, config: Settings): Promise<Credentials> {
    if (!this.refreshing) {
      this.refreshing = this.rotate(credentials, config).finally(() => {
        this.refreshing = undefined;
      });
    }
    return this.refreshing;
  }

  private async rotate(credentials: Credentials, config: Settings): Promise<Credentials> {
    const record = await this.state.storage.get<Record>(recordKey);
    if (record?.phase !== 'active') return gitError(401, 'SESSION_REQUIRED');
    const latestCredentials = await this.readCredentials(record, config);
    if (
      latestCredentials.refreshToken !== credentials.refreshToken ||
      latestCredentials.accessExpiresAt > Date.now()
    ) {
      return latestCredentials;
    }
    if (latestCredentials.refreshExpiresAt <= Date.now()) {
      await this.state.storage.delete(recordKey);
      return gitError(401, 'REAUTH_REQUIRED');
    }
    const tokens = await this.exchange(
      {
        grant_type: 'refresh_token',
        refresh_token: latestCredentials.refreshToken,
      },
      config
    ).catch(async (error) => {
      if (error instanceof GitAuthError && error.status === 401)
        await this.state.storage.delete(recordKey);
      throw error;
    });
    return this.state.storage.transaction(async (tx) => {
      const latest = await tx.get<Record>(recordKey);
      if (latest?.phase !== 'active') return gitError(401, 'SESSION_REQUIRED');
      const current = await this.readCredentials(latest, config);
      const updated = { ...tokens, proxySecret: current.proxySecret };
      await tx.put(recordKey, {
        ...latest,
        credentials: await encrypt(JSON.stringify(updated), await this.encryptionKey(config)),
      });
      return updated;
    });
  }

  private encryptionKey(config: Settings): Promise<CryptoKey> {
    this.key ??= crypto.subtle.importKey(
      'raw',
      Uint8Array.from(config.key.match(/../gu) ?? [], (part) => Number.parseInt(part, 16)),
      'AES-GCM',
      false,
      ['encrypt', 'decrypt']
    );
    return this.key;
  }

  private async readCredentials(record: Active, config: Settings): Promise<Credentials> {
    return JSON.parse(
      await decrypt(record.credentials, await this.encryptionKey(config))
    ) as Credentials;
  }

  private async exchange(
    parameters: RecordOfStrings,
    config: Settings
  ): Promise<Omit<Credentials, 'proxySecret'>> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        ...parameters,
      }),
    });
    if (response.status === 429) return gitError(429, 'RATE_LIMITED');
    if ((response.status >= 300 && response.status < 400) || response.status >= 500) {
      await response.body?.cancel();
      return gitError(502, 'UPSTREAM_FAILURE');
    }
    const token = await response.json<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_token_expires_in?: number;
    }>();
    const validSeconds = (value: unknown): value is number =>
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value > 0 &&
      Number.isSafeInteger(Date.now() + value * 1000);
    if (
      !response.ok ||
      !token.access_token ||
      !tokenPattern.test(token.access_token) ||
      !token.refresh_token ||
      !tokenPattern.test(token.refresh_token) ||
      !validSeconds(token.expires_in) ||
      !validSeconds(token.refresh_token_expires_in)
    )
      return gitError(401, 'REAUTH_REQUIRED');
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      accessExpiresAt: Date.now() + token.expires_in * 1000,
      refreshExpiresAt: Date.now() + token.refresh_token_expires_in * 1000,
    };
  }

  private async github(
    path: string,
    accessToken: string
  ): Promise<{
    login?: string;
    id?: number;
    full_name?: string;
    permissions?: { pull?: boolean; push?: boolean };
  }> {
    const response = await fetch('https://api.github.com' + path, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + accessToken,
        'User-Agent': 'HierarchiDB-Git',
      },
    });
    if (response.status === 401) return gitError(401, 'REAUTH_REQUIRED');
    if (response.status === 403 || response.status === 404) return gitError(403, 'FORBIDDEN');
    if (response.status === 429) return gitError(429, 'RATE_LIMITED');
    if (!response.ok) return gitError(502, 'UPSTREAM_FAILURE');
    return response.json();
  }

  private async lookup(
    remote: Repository,
    write: boolean,
    accessToken: string
  ): Promise<Repository & { id: number }> {
    if (!validRepository(remote.owner, remote.repo)) return gitError(403, 'FORBIDDEN');
    const result = await this.github('/repos/' + remote.owner + '/' + remote.repo, accessToken);
    const name = result.full_name && parseGitRemote('https://github.com/' + result.full_name);
    if (
      !name ||
      !sameRepository(name, remote) ||
      typeof result.id !== 'number' ||
      !Number.isSafeInteger(result.id) ||
      result.id <= 0 ||
      (write ? result.permissions?.push : result.permissions?.pull) !== true
    )
      return gitError(403, 'FORBIDDEN');
    return { ...name, id: result.id };
  }
}

type RecordOfStrings = { [name: string]: string };
