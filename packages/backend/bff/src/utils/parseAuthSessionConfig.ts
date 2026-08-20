import type { MappedEnv } from '~/env-mapper';

export type AuthSessionMode = 'persistent' | 'stateless';

export interface AuthSessionConfig {
  mode: AuthSessionMode;
  durationHours: number;
}

const parseMode = (value: string | undefined): AuthSessionMode => {
  if (value === 'persistent' || value === 'stateless') {
    return value;
  }
  throw new Error('AUTH_SESSION_MODE must be either persistent or stateless');
};

const parseDurationHours = (value: string | undefined): number => {
  if (value === undefined || !/^[1-9]\d*$/.test(value)) {
    throw new Error('SESSION_DURATION_HOURS must be a positive integer');
  }
  const durationHours = Number(value);
  if (!Number.isSafeInteger(durationHours) || !Number.isSafeInteger(durationHours * 3600)) {
    throw new Error('SESSION_DURATION_HOURS must be a safe positive integer');
  }
  return durationHours;
};

export const parseAuthSessionConfig = (
  env: Pick<MappedEnv, 'AUTH_SESSION_MODE' | 'SESSION_DURATION_HOURS'>
): AuthSessionConfig => ({
  mode: parseMode(env.AUTH_SESSION_MODE),
  durationHours: parseDurationHours(env.SESSION_DURATION_HOURS),
});
