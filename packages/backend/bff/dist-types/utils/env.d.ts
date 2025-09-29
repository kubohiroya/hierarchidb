import type { Context } from 'hono';
import { type MappedEnv, type RawEnv } from '../env-mapper.js';
export type BffBindings = {
    Bindings: RawEnv;
    Variables: {
        mappedEnv: MappedEnv;
    };
};
export type BffContext = Context<BffBindings>;
export declare function getEnv(c: BffContext): MappedEnv;
//# sourceMappingURL=env.d.ts.map