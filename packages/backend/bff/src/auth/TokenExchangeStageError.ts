import { OAuthProviderError } from './OAuthProviderError.js';
import type { TokenExchangeProvider } from './parseTokenExchangeRequest.js';

export type TokenExchangeStage =
  | 'provider_configuration'
  | 'provider_token_exchange'
  | 'provider_userinfo'
  | 'session_configuration'
  | 'session_jwt';

export class TokenExchangeStageError extends Error {
  readonly stage: TokenExchangeStage;
  readonly provider: TokenExchangeProvider;
  readonly errorType: string;
  readonly providerStatus: number | undefined;
  readonly providerErrorCode: string | undefined;

  constructor(stage: TokenExchangeStage, provider: TokenExchangeProvider, error: unknown) {
    super(`Token exchange failed at ${stage}`);
    this.name = 'TokenExchangeStageError';
    this.stage = stage;
    this.provider = provider;
    this.errorType = error instanceof Error ? error.name : typeof error;
    this.providerStatus = error instanceof OAuthProviderError ? error.status : undefined;
    this.providerErrorCode =
      error instanceof OAuthProviderError ? error.providerErrorCode : undefined;
  }
}
