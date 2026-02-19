import {
  createMaintenanceSession,
  createMaintenanceSessionUrl,
  markMaintenanceSessionConsumed,
  validateMaintenanceSession,
  clearMaintenanceSession,
} from '~/maintenance/maintenanceSession';

describe('maintenanceSession', () => {
  beforeEach(() => {
    clearMaintenanceSession();
  });

  it('creates and validates session from generated URL', () => {
    const { session, url } = createMaintenanceSessionUrl({
      expectedEmail: 'user@example.com',
      now: 1_000,
      ttlMs: 60_000,
    });

    const parsed = new URL(url);
    const result = validateMaintenanceSession({
      sessionId: parsed.searchParams.get('msid'),
      sessionSecret: parsed.searchParams.get('msk'),
    }, 30_000);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.sessionId).toBe(session.sessionId);
    expect(result.session.expectedEmail).toBe('user@example.com');
  });

  it('rejects missing params', () => {
    createMaintenanceSession();
    const result = validateMaintenanceSession({ sessionId: null, sessionSecret: null });
    expect(result).toEqual({ ok: false, reason: 'missing-params' });
  });

  it('rejects expired session', () => {
    const session = createMaintenanceSession({ now: 1_000, ttlMs: 500 });
    const result = validateMaintenanceSession(
      { sessionId: session.sessionId, sessionSecret: session.sessionSecret },
      2_000
    );

    expect(result).toEqual({ ok: false, reason: 'session-expired' });
  });

  it('rejects consumed session', () => {
    const session = createMaintenanceSession();
    markMaintenanceSessionConsumed(session.sessionId, 100);
    const result = validateMaintenanceSession({
      sessionId: session.sessionId,
      sessionSecret: session.sessionSecret,
    }, 101);

    expect(result).toEqual({ ok: false, reason: 'session-consumed' });
  });
});
