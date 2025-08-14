// import { devError } from "@/shared/utils/logger.ts";
const devError = (msg: string, error?: any) => console.error(msg, error);
import { handleAuthError } from './handleAuthError';

/**
 * fetchリクエストのラッパー関数。401エラーを検出して適切に処理する
 * @param input fetch APIのinputパラメータ
 * @param init fetch APIのinitパラメータ
 */
export async function fetchWithAuthErrorHandling(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  try {
    const response = await fetch(input, init);

    if (response.status === 401) {
      handleAuthError();
    }

    return response;
  } catch (error) {
    devError('Fetch error:', error);
    throw error;
  }
}
