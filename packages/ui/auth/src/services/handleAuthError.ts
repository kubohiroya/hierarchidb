// import { devWarn } from "@/shared/utils/logger";
// const devWarn = (msg: string) => console.warn(msg);

/**
 */
export function handleAuthError(): void {
  //  SimpleBFFAuth
  if (import.meta.env.DEV) {
    console.warn('Authentication error detected. User needs to sign in manually.');
  }

  //  -
  // const authErrorEvent = new CustomEvent("Auth-error", {
  //  detail: { message: "" },
  // });
  // window.dispatchEvent(authErrorEvent);
}
