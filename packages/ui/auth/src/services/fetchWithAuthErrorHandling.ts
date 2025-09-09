// import { devError } from "@/shared/utils/logger.ts";
// const devError = (msg: string, error?: any) => console.error(msg, error);
import { handleAuthError } from './handleAuthError';

/**
  * fetch401
 * @param input fetch APIinput
 * @param init fetch APIinit
  */
export async function fetchWithAuthErrorHandling(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    const response = await fetch(input, init);

    if (response.status === 401) {
      handleAuthError();
    }

    return response;
  } catch (error) {
    if (import.meta.env.DEV) {

      console.error('Fetch error:', error);

    }
    throw error;
  }
}
