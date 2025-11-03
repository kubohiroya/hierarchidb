import type { Context } from 'hono';
import { type MappedEnv, mapEnvironmentVariables, type RawEnv } from '../env-mapper.js';

export type BffBindings = { Bindings: RawEnv; Variables: { mappedEnv: MappedEnv } };
export type BffContext = Context<BffBindings>;

const ENV_CACHE_KEY = 'mappedEnv';

export function getEnv(c: BffContext): MappedEnv {
  const cached = c.get(ENV_CACHE_KEY);
  if (cached) {
    return cached;
  }
  const mapped = mapEnvironmentVariables(c.env);
  c.set(ENV_CACHE_KEY, mapped);
  return mapped;
}
