import { generateIso3166Files } from "./scraper.js";
export * from "./index.js";
import * as process from "node:process";

const isDirectRun = (() => {
  if (typeof process === "undefined" || typeof import.meta.url !== "string") return false;
  try {
    const current = new URL(import.meta.url);
    const entry = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : "";
    return current.href === entry;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  generateIso3166Files().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
