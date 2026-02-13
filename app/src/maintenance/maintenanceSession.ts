const MAINTENANCE_SESSION_STORAGE_KEY = 'hdb:maintenance:session:v1';
let inMemorySessionRaw: string | null = null;

const DEFAULT_SESSION_TTL_MS = 90_000;
const CONFIRMATION_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface MaintenanceSessionRecord {
  sessionId: string;
  sessionSecret: string;
  confirmationCode: string;
  expectedEmail: string | null;
  createdAt: number;
  expiresAt: number;
  consumedAt: number | null;
}

export type MaintenanceSessionValidationResult =
  | { ok: true; session: MaintenanceSessionRecord }
  | {
      ok: false;
      reason:
        | 'missing-params'
        | 'missing-session'
        | 'session-mismatch'
        | 'session-expired'
        | 'session-consumed';
    };

const isBrowser = () => typeof window !== 'undefined';

const randomToken = (bytes: number): string => {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

const randomCode = (length = 6): string => {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values)
    .map((value) => CONFIRMATION_CODE_CHARS[value % CONFIRMATION_CODE_CHARS.length])
    .join('');
};

const parseSession = (raw: string | null): MaintenanceSessionRecord | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MaintenanceSessionRecord>;
    if (
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.sessionSecret !== 'string' ||
      typeof parsed.confirmationCode !== 'string' ||
      typeof parsed.createdAt !== 'number' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }
    return {
      sessionId: parsed.sessionId,
      sessionSecret: parsed.sessionSecret,
      confirmationCode: parsed.confirmationCode,
      expectedEmail: typeof parsed.expectedEmail === 'string' ? parsed.expectedEmail : null,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
      consumedAt: typeof parsed.consumedAt === 'number' ? parsed.consumedAt : null,
    };
  } catch {
    return null;
  }
};

const writeSession = (record: MaintenanceSessionRecord): void => {
  const raw = JSON.stringify(record);
  inMemorySessionRaw = raw;
  if (!isBrowser()) return;
  window.sessionStorage.setItem(MAINTENANCE_SESSION_STORAGE_KEY, raw);
};

export const clearMaintenanceSession = (): void => {
  inMemorySessionRaw = null;
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(MAINTENANCE_SESSION_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
};

export const getStoredMaintenanceSession = (): MaintenanceSessionRecord | null => {
  if (!isBrowser()) return parseSession(inMemorySessionRaw);
  try {
    const sessionValue = window.sessionStorage.getItem(MAINTENANCE_SESSION_STORAGE_KEY);
    return parseSession(sessionValue ?? inMemorySessionRaw);
  } catch {
    return parseSession(inMemorySessionRaw);
  }
};

export const createMaintenanceSession = (options?: {
  expectedEmail?: string | null;
  ttlMs?: number;
  now?: number;
}): MaintenanceSessionRecord => {
  const now = options?.now ?? Date.now();
  const ttlMs = options?.ttlMs ?? DEFAULT_SESSION_TTL_MS;
  const record: MaintenanceSessionRecord = {
    sessionId: randomToken(12),
    sessionSecret: randomToken(16),
    confirmationCode: randomCode(6),
    expectedEmail: options?.expectedEmail?.trim() || null,
    createdAt: now,
    expiresAt: now + ttlMs,
    consumedAt: null,
  };
  writeSession(record);
  return record;
};

export const buildMaintenanceUrl = (record: MaintenanceSessionRecord): string => {
  if (!isBrowser()) return '/maintenance';
  const basePath = import.meta.env.BASE_URL || '/';
  const relativePath = `${basePath.replace(/\/+$/, '')}/maintenance`;
  const url = new URL(relativePath, window.location.origin);
  url.searchParams.set('msid', record.sessionId);
  url.searchParams.set('msk', record.sessionSecret);
  return url.toString();
};

export const createMaintenanceSessionUrl = (options?: {
  expectedEmail?: string | null;
  ttlMs?: number;
  now?: number;
}): { session: MaintenanceSessionRecord; url: string } => {
  const session = createMaintenanceSession(options);
  return { session, url: buildMaintenanceUrl(session) };
};

export const validateMaintenanceSession = (
  params: { sessionId?: string | null; sessionSecret?: string | null },
  now = Date.now()
): MaintenanceSessionValidationResult => {
  const sessionId = params.sessionId ?? null;
  const sessionSecret = params.sessionSecret ?? null;

  if (!sessionId || !sessionSecret) {
    return { ok: false, reason: 'missing-params' };
  }

  const stored = getStoredMaintenanceSession();
  if (!stored) {
    return { ok: false, reason: 'missing-session' };
  }

  if (stored.expiresAt <= now) {
    clearMaintenanceSession();
    return { ok: false, reason: 'session-expired' };
  }

  if (stored.sessionId !== sessionId || stored.sessionSecret !== sessionSecret) {
    return { ok: false, reason: 'session-mismatch' };
  }

  if (stored.consumedAt !== null) {
    return { ok: false, reason: 'session-consumed' };
  }

  return { ok: true, session: stored };
};

export const markMaintenanceSessionConsumed = (sessionId: string, now = Date.now()): void => {
  const stored = getStoredMaintenanceSession();
  if (!stored || stored.sessionId !== sessionId) return;
  writeSession({
    ...stored,
    consumedAt: now,
  });
};

export const getMaintenanceSessionStorageKey = (): string => MAINTENANCE_SESSION_STORAGE_KEY;
