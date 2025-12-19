import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { DEFAULT_FAILURES, DEFAULT_OUTPUT, toCsv } from "./csv.js";
import {
  type CountryRow,
  type GenerateOptions,
  type GenerateResult,
  type SubdivisionRow,
} from "./types.js";
import pLimit from "p-limit";
import { FetchNetworkPort } from "@hierarchidb/download";

const START_URL = "https://ja.wikipedia.org/wiki/ISO_3166-1";
const JA_WIKI = "https://ja.wikipedia.org";
const EN_WIKI = "https://en.wikipedia.org";

const CONCURRENCY = 6;
const REQUEST_DELAY_MS = 400; // polite delay
const USER_AGENT = "iso3166-2-level1-csv-generator/1.0 (contact: example@example.com)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url: string, retries = 3): Promise<string> {
  const net = new FetchNetworkPort();
  for (let i = 0; i < retries; i++) {
    try {
      await sleep(REQUEST_DELAY_MS);
      const res = await net.get(url, {
        headers: {
          "user-agent": USER_AGENT,
          "accept-language": "ja,en;q=0.8",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      return new TextDecoder().decode(buf);
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(600 * (i + 1));
    }
  }
  throw new Error("unreachable");
}

const normText = (s: string): string =>
  s.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const absoluteUrl = (base: string, href?: string | null): string | undefined => {
  if (!href) return undefined;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("//")) return "https:" + href;
  if (href.startsWith("/")) return base + href;
  return undefined;
};

export async function parseIso3166_1Countries(): Promise<CountryRow[]> {
  const html = await fetchHtml(START_URL);
  const $ = cheerio.load(html);

  // Find the main "wikitable" that contains alpha-2 and alpha-3 columns.
  const tables = $("table.wikitable");
  let target: any = null;

  tables.each((_, el: any) => {
    const headerText = normText($(el as any).find("tr").first().text());
    if (headerText.includes("alpha-2") && headerText.includes("alpha-3")) {
      target = $(el as any);
      return false;
    }
  });

  if (!target) {
    throw new Error("Could not find ISO 3166-1 country table on the start page.");
  }

  const table = target as any;

  // Identify column indices by header cells.
  const headerCells = table.find("tr").first().find("th,td").toArray();
  const headers = headerCells.map((c: any) => normText($(c as any).text()));

  const idxCountryEn = headers.findIndex((h: string) => h.includes("英語名"));
  const idxAlpha3 = headers.findIndex((h: string) => h.includes("alpha-3"));
  const idxAlpha2 = headers.findIndex((h: string) => h.includes("alpha-2"));
  const idxLocation = headers.findIndex((h: string) => h.includes("場所"));
  const idxAdminLink = headers.findIndex((h: string) => h.includes("各行政区分"));

  if (idxCountryEn < 0 || idxAlpha3 < 0 || idxAlpha2 < 0) {
    throw new Error(`Missing expected columns. headers=${JSON.stringify(headers)}`);
  }

  const rows: CountryRow[] = [];

  table.find("tr").slice(1).each((_: any, tr: any) => {
    const tds = $(tr as any).find("td").toArray();
    if (tds.length < Math.max(idxAlpha2, idxAlpha3, idxCountryEn) + 1) return;

    const countryEn = normText($(tds[idxCountryEn]).text());
    const alpha3 = normText($(tds[idxAlpha3]).text()).replace(/`/g, "");
    const alpha2 = normText($(tds[idxAlpha2]).text()).replace(/`/g, "");
    const location = idxLocation >= 0 ? normText($(tds[idxLocation]).text()) : "";

    if (!alpha2 || alpha2.length !== 2) return;

    let iso3166_2_url: string | undefined;
    if (idxAdminLink >= 0 && tds[idxAdminLink]) {
      const a = $(tds[idxAdminLink]).find("a").first();
      const href = a.attr("href");
      iso3166_2_url = absoluteUrl(JA_WIKI, href);
    }

    rows.push({ countryEn, alpha3, alpha2, location, iso3166_2_url });
  });

  return rows;
}

type ParsedTable = {
  score: number;
  rows: Array<{ code: string; nameLocal: string; nameEn: string }>;
};

function scoreTable($: CheerioAPI, table: any, alpha2: string): ParsedTable {
  const $table = $(table as any);
  const header = normText($table.find("tr").first().text()).toLowerCase();

  const hasEnCol = header.includes("(en)") || header.includes("english") || header.includes("英");
  const looksCurrentCodes = header.includes("code") || header.includes("コード");

  // Parse rows
  const rows: Array<{ code: string; nameLocal: string; nameEn: string }> = [];

  $table.find("tr").slice(1).each((_: any, tr: any) => {
    const cells = $(tr as any).find("td,th").toArray().map((c: any) => normText($(c as any).text()));
    if (cells.length < 2) return;

    const codeCell = cells.find((c) => c.startsWith(alpha2 + "-"));
    if (!codeCell) return;

    const code = codeCell;

    let nameEn = "";
    let nameLocal = "";

    const headerCells = $table
      .find("tr")
      .first()
      .find("th,td")
      .toArray()
      .map((c: any) => normText($(c as any).text()).toLowerCase());

    const idxEn = headerCells.findIndex((h: string) => h.includes("(en)") || h.includes("english") || h.includes("英語"));
    const idxLocal = headerCells.findIndex((h: string) => h.includes("(ja)") || h.includes("現地") || h.includes("日本語") || h.includes("name"));

    const cellAt = (i: number) => (i >= 0 && i < cells.length ? cells[i] ?? "" : "");

    if (idxEn >= 0) nameEn = cellAt(idxEn);
    if (idxLocal >= 0) nameLocal = cellAt(idxLocal);

    if (!nameLocal) {
      const nonCode = cells.filter((c) => c && !c.startsWith(alpha2 + "-"));
      nameLocal = nonCode[0] ?? "";
      if (!nameEn && nonCode.length >= 2) nameEn = nonCode[1] ?? "";
    }

    if (!nameEn) nameEn = nameLocal;

    rows.push({ code, nameLocal, nameEn });
  });

  let score = 0;
  score += Math.min(rows.length, 200);
  if (looksCurrentCodes) score += 40;
  if (hasEnCol) score += 30;

  const shortish = rows.filter((r) => new RegExp(`^${alpha2}-[A-Z0-9]{1,3}$`).test(r.code)).length;
  score += Math.min(shortish, 50);

  return { score, rows };
}

export async function parseIso3166_2Page(alpha2: string): Promise<Array<{ code: string; nameLocal: string; nameEn: string }>> {
  const enUrl = `${EN_WIKI}/wiki/ISO_3166-2:${alpha2}`;

  let html: string | null = null;
  html = await fetchHtml(enUrl);

  const $ = cheerio.load(html);
  const tables = $("table.wikitable").toArray();
  if (tables.length === 0) {
    const enHtml = await fetchHtml(enUrl);
    const $en = cheerio.load(enHtml);
    const enTables = $en("table.wikitable").toArray();
    if (enTables.length === 0) return [];
    const scored = enTables.map((t: any) => scoreTable($en, t, alpha2)).sort((a, b) => b.score - a.score)[0];
    return scored?.rows ?? [];
  }

  const scoredBest = tables
    .map((t: any) => scoreTable($, t, alpha2))
    .sort((a, b) => b.score - a.score)[0];

  return scoredBest?.rows ?? [];
}

export async function generateIso3166Data(): Promise<GenerateResult> {
  const countries = await parseIso3166_1Countries();

  const limit = pLimit(CONCURRENCY);
  const results: SubdivisionRow[] = [];
  const failures: Array<{ alpha2: string; reason: string }> = [];

  await Promise.all(
    countries.map((c) =>
      limit(async () => {
        try {
          const subs = await parseIso3166_2Page(c.alpha2);
          if (!subs.length) {
            failures.push({ alpha2: c.alpha2, reason: "no subdivision rows found" });
            return;
          }

          for (const s of subs) {
            results.push({
              countryEn: c.countryEn,
              alpha3: c.alpha3,
              alpha2: c.alpha2,
              location: c.location,
              subdivisionEn: s.nameEn,
              subdivisionLocal: s.nameLocal,
              subdivisionCode: s.code,
            });
          }
        } catch (e: any) {
          failures.push({ alpha2: c.alpha2, reason: String(e?.message ?? e) });
        }
      }),
    ),
  );

  results.sort((a, b) =>
    a.alpha2.localeCompare(b.alpha2) ||
    a.subdivisionCode.localeCompare(b.subdivisionCode),
  );

  return { rows: results, countries, failures };
}

export async function generateIso3166Files(options: GenerateOptions = {}): Promise<void> {
  const outputDir = options.outputDir ?? process.cwd();
  const outputFile = options.outputFile ?? DEFAULT_OUTPUT;
  const failureFile = options.failureFile ?? DEFAULT_FAILURES;
  const log = options.logger ?? ((msg: string) => console.log(msg));
  const fs = await import("node:fs/promises");

  const { rows: results, failures } = await generateIso3166Data();

  const csv = toCsv(results);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(new URL(outputFile, `file://${outputDir}/`), csv, "utf8");

  const failCsv =
    ["alpha_2,reason"]
      .concat(failures.map((f) => `${f.alpha2},${f.reason}`))
      .join("\n") + "\n";
  await fs.writeFile(new URL(failureFile, `file://${outputDir}/`), failCsv, "utf8");

  log(`iso3166-2: wrote ${outputFile} (${results.length} rows)`);
  log(`iso3166-2: wrote ${failureFile} (${failures.length} failures)`);
}
