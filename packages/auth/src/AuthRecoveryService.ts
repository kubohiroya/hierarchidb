import { AuthService } from './AuthService.js';

/**
 * @deprecated Use {@link AuthService} for authenticated fetches, including initial auth.
 * This class remains for backward-compatible imports.
 */
export class AuthRecoveryService extends AuthService {
  static override async getSingleton(): Promise<AuthService> {
    return AuthService.getSingleton();
  }
}
