// import { devWarn } from "@/shared/utils/logger";
const devWarn = (msg: string) => console.warn(msg);

/**
 * 認証エラーが発生した場合にトークンを破棄し、再認証画面へのリダイレクトを行う関数
 */
export function handleAuthError(): void {
  // SimpleBFFAuth環境では自動的な認証フローをトリガーしない
  // ユーザーが明示的にログインボタンを押すまで待つ
  devWarn('Authentication error detected. User needs to sign in manually.');

  // 以下のコードは無効化 - 自動的な認証フローを防ぐため
  // const authErrorEvent = new CustomEvent("Auth-error", {
  //   detail: { message: "認証情報が無効になりました。再認証が必要です。" },
  // });
  // window.dispatchEvent(authErrorEvent);
}
