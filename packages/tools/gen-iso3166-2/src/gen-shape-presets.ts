import * as fs from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv.js";
import i18nCountries from "i18n-iso-countries";

type GeoboundariesRecord = Record<string, unknown>;
type GeoboundariesLevel = 0 | 1 | 2;
type GeoboundariesPayload = GeoboundariesRecord | GeoboundariesRecord[];
type Iso3ToIso2Map = Map<string, string>;
type GeoboundariesLevelName = `level${GeoboundariesLevel}`;
type CachedGeoboundariesCache = {
  level0: string[];
  level1: string[];
};

const GEOBOUNDARIES_API_BY_LEVEL: Record<GeoboundariesLevel, string> = {
  0: "https://www.geoboundaries.org/api/current/gbOpen/ALL/ADM0/",
  1: "https://www.geoboundaries.org/api/current/gbOpen/ALL/ADM1/",
  2: "https://www.geoboundaries.org/api/current/gbOpen/ALL/ADM2/",
};

const OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
  "app",
  "src",
  "features",
  "shape",
  "generated",
  "geoboundaries-shape-presets.generated.ts",
);
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const LOCAL_ISO3166_CSV_CANDIDATES = [
  resolve(process.cwd(), "app/public/iso3166-2-level1.csv"),
  resolve(REPO_ROOT, "app/public/iso3166-2-level1.csv"),
];
const USER_ASSIGNED_MAP_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../user-assigned-iso3166.json",
);
const GENERATED_CACHE_PATH = OUTPUT_PATH;
const MAX_FETCH_RETRIES = 3;
const FETCH_TIMEOUT_MS = 30000;
const FETCH_RETRY_DELAY_MS = 1000;

const toPositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const resolveFetchTimeoutMs = (): number => toPositiveInteger(
  process.env.GEOBOUNDARIES_FETCH_TIMEOUT_MS,
  FETCH_TIMEOUT_MS,
);

const resolveFetchRetries = (): number => toPositiveInteger(
  process.env.GEOBOUNDARIES_FETCH_RETRIES,
  MAX_FETCH_RETRIES,
);

const resolveFetchRetryDelayMs = (): number => toPositiveInteger(
  process.env.GEOBOUNDARIES_FETCH_RETRY_DELAY_MS,
  FETCH_RETRY_DELAY_MS,
);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const fetchWithTimeout = async (url: string, timeoutMs: number, init?: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

const isFile = async (path: string): Promise<boolean> => {
  try {
    const stat = await fs.stat(path);
    return stat.isFile();
  } catch {
    return false;
  }
};

const resolveIso3166CsvPath = async (): Promise<string | null> => {
  for (const candidate of LOCAL_ISO3166_CSV_CANDIDATES) {
    if (await isFile(candidate)) {
      return candidate;
    }
  }
  return null;
};

const isCode = (value: string, length: number): boolean => new RegExp(`^[A-Z]{${length}}$`).test(value);

const toMap = (value: string): string => value.trim().toUpperCase();

const mergeEntries = (
  target: Iso3ToIso2Map,
  source: Iso3ToIso2Map,
  options: { overwrite?: boolean } = {},
): void => {
  const { overwrite = false } = options;
  source.forEach((iso2, iso3) => {
    if (overwrite || !target.has(iso3)) {
      target.set(iso3, iso2);
    }
  });
};

const parseIso3166MapText = (text: string): Iso3ToIso2Map => {
  const rows = parseCsv(text);
  const map = new Map<string, string>();
  for (const row of rows) {
    const alpha3 = toMap(row.alpha3);
    const alpha2 = toMap(row.alpha2);
    if (isCode(alpha3, 3) && isCode(alpha2, 2)) {
      map.set(alpha3, alpha2);
    }
  }
  return map;
};

const loadIso3166CsvMap = async (): Promise<Iso3ToIso2Map> => {
  const csvPath = await resolveIso3166CsvPath();
  if (!csvPath) {
    return new Map<string, string>();
  }
  const csvText = await fs.readFile(csvPath, "utf8");
  return parseIso3166MapText(csvText);
};

type CountryApiLike = { getAlpha3Codes: () => Record<string, string> };
type CountryModuleLike = { default?: unknown };

const hasGetAlpha3Codes = (value: unknown): value is CountryApiLike => {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { getAlpha3Codes?: unknown }).getAlpha3Codes === "function"
  );
};

const loadIso3166LibraryMap = (): Iso3ToIso2Map => {
  const countriesApiModule = i18nCountries as unknown as CountryModuleLike;

  const countriesApi = (() => {
    if (hasGetAlpha3Codes(countriesApiModule)) {
      return countriesApiModule;
    }
    const defaultApi = (countriesApiModule as CountryModuleLike).default;
    if (hasGetAlpha3Codes(defaultApi)) {
      return defaultApi;
    }
    return null;
  })();
  if (!countriesApi) return new Map<string, string>();

  const map = new Map<string, string>();
  const pairs = countriesApi.getAlpha3Codes();
  for (const [alpha3, alpha2] of Object.entries(pairs)) {
    const upperAlpha3 = toMap(alpha3);
    const upperAlpha2 = toMap(alpha2);
    if (isCode(upperAlpha3, 3) && isCode(upperAlpha2, 2)) {
      map.set(upperAlpha3, upperAlpha2);
    }
  }
  return map;
};

const loadUserAssignedMap = async (): Promise<Iso3ToIso2Map> => {
  try {
    const text = await fs.readFile(USER_ASSIGNED_MAP_PATH, "utf8");
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return new Map<string, string>();

    const map = new Map<string, string>();
    for (const [alpha3, value] of Object.entries(raw)) {
      if (typeof value !== "string") continue;
      const upperAlpha3 = toMap(alpha3);
      const upperAlpha2 = toMap(value);
      if (isCode(upperAlpha3, 3) && isCode(upperAlpha2, 2)) {
        map.set(upperAlpha3, upperAlpha2);
      }
    }
    return map;
  } catch {
    return new Map<string, string>();
  }
};

const loadIso3166Map = async (): Promise<Iso3ToIso2Map> => {
  const map = await loadIso3166CsvMap();
  mergeEntries(map, loadIso3166LibraryMap());
  mergeEntries(map, await loadUserAssignedMap(), { overwrite: true });
  return map;
};

const readJsonArrayTextFromGeneratedCache = (
  text: string,
  levelName: GeoboundariesLevelName,
): string | null => {
  const marker = `${levelName}:`;
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }
  let cursor = markerIndex + marker.length;
  while (cursor < text.length) {
    const char = text[cursor];
    if (char === undefined || !/\s/.test(char)) {
      break;
    }
    cursor += 1;
  }

  if (text[cursor] !== "[") {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  const start = cursor;
  for (let i = cursor; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "[") {
      depth += 1;
      continue;
    }
    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
};

const loadGeoboundariesCachedByLevel = async (
  level: GeoboundariesLevel,
): Promise<ReadonlySet<string> | null> => {
  try {
    const text = await fs.readFile(GENERATED_CACHE_PATH, "utf8");
    const levelName = `level${level}` as GeoboundariesLevelName;

    const cache: CachedGeoboundariesCache | null = (() => {
      const level0Text = readJsonArrayTextFromGeneratedCache(text, "level0");
      const level1Text = readJsonArrayTextFromGeneratedCache(text, "level1");
      if (!level0Text || !level1Text) {
        return null;
      }

      const parseArray = (value: string): unknown[] => {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          return [];
        }
        return parsed;
      };

      const level0 = parseArray(level0Text).filter((value): value is string => typeof value === "string");
      const level1 = parseArray(level1Text).filter((value): value is string => typeof value === "string");

      return {
        level0,
        level1,
      };
    })();

    if (!cache) return null;

    const rawValues = levelName === "level0" ? cache.level0 : cache.level1;
    const output = new Set<string>();
    for (const rawValue of rawValues) {
      const normalized = toMap(rawValue);
      if (isCode(normalized, 2)) {
        output.add(normalized);
      }
    }
    if (output.size === 0) {
      return null;
    }
    return output;
  } catch {
    return null;
  }
};

const isString = (value: unknown): value is string => typeof value === "string";

const readFirstString = (record: GeoboundariesRecord, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const raw = record[key];
    if (isString(raw)) {
      const trimmed = raw.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const readGeoboundariesPayload = (payload: unknown): GeoboundariesRecord[] => {
  if (Array.isArray(payload)) return payload as GeoboundariesRecord[];
  if (payload && typeof payload === "object") {
    const directData = (payload as GeoboundariesPayload as { data?: unknown }).data;
    if (Array.isArray(directData)) return directData as GeoboundariesRecord[];
  }
  return [];
};

const extractIso2 = (
  record: GeoboundariesRecord,
  iso3ToIso2: Map<string, string>,
): string | null => {
  const raw = readFirstString(record, [
    "boundaryISO",
    "iso3",
    "ISO3",
    "shapeISO",
    "shapeISO3",
    "boundaryISO3",
    "countryCode",
    "countryISO",
    "country_code",
    "iso",
  ]);
  if (!raw) return null;
  const [first = ""] = raw.split(/[,\s;/|]/);
  const upper = first.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  if (/^[A-Z]{3}$/.test(upper)) {
    return iso3ToIso2.get(upper) ?? null;
  }
  return null;
};

const loadGeoboundariesCountries = async (
  level: GeoboundariesLevel,
  iso3ToIso2: Map<string, string>,
): Promise<ReadonlySet<string>> => {
  const url = GEOBOUNDARIES_API_BY_LEVEL[level];
  const maxRetries = resolveFetchRetries();
  const timeoutMs = resolveFetchTimeoutMs();
  const retryDelayMs = resolveFetchRetryDelayMs();

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs, { headers: { accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`Failed to fetch geoboundaries level ${level}: ${response.status}`);
      }
      const payload = await response.json();
      const records = readGeoboundariesPayload(payload);
      const output = new Set<string>();
      for (const record of records) {
        const iso = extractIso2(record, iso3ToIso2);
        if (iso && /^[A-Z]{2}$/.test(iso)) {
          output.add(iso);
        }
      }
      return output;
  } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) {
        const fallback = await loadGeoboundariesCachedByLevel(level);
        if (fallback) {
          console.warn(`Using cached geoboundaries level ${level} data due to fetch failure.`);
          return fallback;
        }
        break;
      }
      const nextDelay = retryDelayMs * 2 ** attempt;
      const waitMs = Math.min(10000, nextDelay);
      console.warn(`Failed geoboundaries level ${level} fetch (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${waitMs}ms`, error);
      await sleep(waitMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch geoboundaries level ${level}`);
};

const buildGeneratedPayload = async (): Promise<{
  level0: string[];
  level1: string[];
}> => {
  const iso3ToIso2 = await loadIso3166Map();

  const level0 = Array.from(await loadGeoboundariesCountries(0, iso3ToIso2)).sort();
  const level1 = Array.from(await loadGeoboundariesCountries(1, iso3ToIso2)).sort();
  return { level0, level1 };
};

const renderGeneratedFile = (level0: string[], level1: string[]): string =>
  `// generated by @hierarchidb/gen-iso3166-2
// This file is produced at build time. Do not edit manually.
export const GEOBOUNDARIES_COUNTRIES_BY_LEVEL = {
  level0: ${JSON.stringify(level0, null, 2)},
  level1: ${JSON.stringify(level1, null, 2)},
} as const;
`;

const writeGeneratedFile = async (level0: string[], level1: string[]) => {
  const directory = dirname(OUTPUT_PATH);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, renderGeneratedFile(level0, level1), "utf8");
};

const isDirectRun = (() => {
  if (typeof process === "undefined" || typeof import.meta.url !== "string") return false;
  try {
    const current = new URL(import.meta.url);
    const entry = process.argv[1] ? new URL(`file://${process.argv[1]}`) : null;
    if (!entry) return false;
    return current.href === entry.href;
  } catch {
    return false;
  }
})();

const main = async () => {
  const data = await buildGeneratedPayload();
  await writeGeneratedFile(data.level0, data.level1);
};

if (isDirectRun) {
  void main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { buildGeneratedPayload };
