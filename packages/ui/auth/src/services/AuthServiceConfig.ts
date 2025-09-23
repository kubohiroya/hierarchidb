/**
  * : AuthService
 * :
 * :
 * : OAuth2.0
  */

/**
  * :
 * : null/undefined
 * : OAuth2.0
  */
export interface AuthConfig {
  authUrl: string;
  authOrigin: string;
  clientId: string;
  redirectUri: string;
  popupRedirectUri: string;
  scope: string;
  responseType: string;
  usePKCE?: boolean;
}

/**
  * :
 * :
 * :
  */
export const AUTH_CONSTANTS = {
  //  :
  POPUP_TIMEOUT_MS: 5 * 60 * 1000, //  5
  TOKEN_EXPIRY_BUFFER_SECONDS: 30,
  //  :
  DEFAULT_MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,

  //  : UX
  POPUP_WIDTH: 500,
  POPUP_HEIGHT: 600,
  POPUP_CHECK_INTERVAL_MS: 500,

  //  PKCE:
  CODE_VERIFIER_LENGTH: 128,
  CODE_CHALLENGE_METHOD: 'S256' as const,
} as const;

/**
  * : AuthConfig
 * :
 * :
 * :
  */
export class AuthConfigValidator {
  private static validatedConfigs = new WeakMap<AuthConfig, boolean>();

  /**
      * : AuthConfig
   * : URLOrigin
   * : WeakMap
   * : OWASP
      */
  static validate(config: AuthConfig): void {
    //  :
    if (this.validatedConfigs.has(config)) {
      return;
    }

    //  :
    this.validateRequiredFields(config);

    //  URL: URL
    this.validateUrls(config);

    //  : OAuth2.0
    this.validateAuthParams(config);

    //  :
    this.validatedConfigs.set(config, true);
  }

  /**
      * :
   * :
   * :
      */
  private static validateRequiredFields(config: AuthConfig): void {
    const requiredFields: (keyof AuthConfig)[] = [
      'authUrl', 'authOrigin', 'clientId',
      'redirectUri', 'popupRedirectUri',
      'scope', 'responseType',
    ];

    for (const field of requiredFields) {
      if (!config[field] || (typeof config[field] === 'string' && !(config[field] as string).trim())) {
        throw new Error(`設定エラー: ${field}は必須項目です`);
      }
    }
  }

  /**
      * URL: URL
   * : HTTPS
   * :
      */
  private static validateUrls(config: AuthConfig): void {
    const urlFields: (keyof AuthConfig)[] = ['authUrl', 'redirectUri', 'popupRedirectUri'];

    for (const field of urlFields) {
      const url = config[field] as string;
      if (!this.isValidUrl(url)) {
        throw new Error(`設定エラー: ${field}のURL形式が不正です: ${url}`);
      }

      //  HTTPS: HTTPSVite
      if (import.meta.env.PROD && !url.startsWith('https://')) {
        throw new Error(`セキュリティエラー: 本番環境では${field}はHTTPSである必要があります`);
      }
    }

    //  Origin: Origin
    if (!this.isValidOrigin(config.authOrigin)) {
      throw new Error(`設定エラー: authOriginの形式が不正です: ${config.authOrigin}`);
    }
  }

  /**
      * : OAuth2.0
   * :
   * : OAuth2.0 RFC
      */
  private static validateAuthParams(config: AuthConfig): void {
    //  Response Type:
    const validResponseTypes = ['code', 'token', 'id_token'];
    if (!validResponseTypes.includes(config.responseType)) {
      if (import.meta.env.DEV) {

        console.warn(`非標準のresponseType: ${config.responseType}`);

      }
    }

    //  Scope:
    if (!config.scope.includes('openid')) {
      if (import.meta.env.DEV) {

        console.warn('OpenID Connectを使用する場合、scopeに"openid"を含めることを推奨します');

      }
    }
  }

  /**
      * URL: URL
   * : try-catch
   * : URL
      */
  private static isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['https:', 'http:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
      * Origin: Origin
   * : CORS
   * :
      */
  private static isValidOrigin(origin: string): boolean {
    try {
      const url = new URL(origin);
      return url.origin === origin && !origin.endsWith('/');
    } catch {
      return false;
    }
  }

  /**
      * :
   * :
   * :
   * :
      */
  static freezeConfig(config: AuthConfig): Readonly<AuthConfig> {
    return Object.freeze({ ...config });
  }
}
