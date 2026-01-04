import { AuthService } from './AuthService.js';

/**
 * @deprecated 初回認証も含めた認証付きfetchの入口は {@link AuthService} に統一しました。
 * 既存import互換のためにこの名前を残しています。
 */
export class AuthRecoveryService extends AuthService {
  static override async getSingleton(): Promise<AuthService> {
    return AuthService.getSingleton();
  }
}
