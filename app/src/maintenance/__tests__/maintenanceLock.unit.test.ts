import {
  clearMaintenanceLock,
  getMaintenanceLock,
  isMaintenanceLockActive,
  setMaintenanceLock,
} from '~/maintenance/maintenanceLock';

describe('maintenanceLock', () => {
  beforeEach(() => {
    clearMaintenanceLock();
  });

  it('sets and reads active lock', () => {
    setMaintenanceLock({
      sessionId: 'session-1',
      createdAt: 1_000,
      expiresAt: 2_000,
    });

    expect(isMaintenanceLockActive(1_500)).toBe(true);
    expect(getMaintenanceLock(1_500)?.sessionId).toBe('session-1');
  });

  it('clears expired lock automatically', () => {
    setMaintenanceLock({
      sessionId: 'session-2',
      createdAt: 1_000,
      expiresAt: 1_100,
    });

    expect(isMaintenanceLockActive(1_200)).toBe(false);
    expect(getMaintenanceLock(1_200)).toBeNull();
  });
});
