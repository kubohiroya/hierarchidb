/**
  * OAuth State Parameter Management for CSRF Protection
 * HMACKVS
  */
import type { Context } from 'hono';
interface StateData {
    origin?: string;
    timestamp: number;
    nonce: string;
}
/**
  * HMACState
 * KVSCSRF
  */
export declare class StateManager {
    private secret;
    private static readonly STATE_TTL;
    private key;
    constructor(secret: string);
    /**
        * HMAC
        */
    private getKey;
    /**
        * HMAC
        */
    private createSignature;
    /**
              */
    private verifySignature;
    /**
        * stateKVSHMAC
        */
    createState(c: Context, origin?: string): Promise<string>;
    /**
        * stateKVS
        */
    validateState(state: string): Promise<StateData | null>;
    /**
        * stateorigin
        */
    static extractOriginFromState(state: string): string | undefined;
}
export {};
//# sourceMappingURL=state-manager.d.ts.map