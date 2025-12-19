import type { SubdivisionRow } from "./types.js";

export const DEFAULT_OUTPUT = "iso3166-2-level1.csv";
export const DEFAULT_FAILURES = "iso3166-2-level1.failures.csv";

export function csvEscape(v: string): string {
  const s = v ?? "";
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: SubdivisionRow[]): string {
  const header = [
    "country_en",
    "alpha_3",
    "alpha_2",
    "location",
    "subdivision_en",
    "subdivision_local",
    "subdivision_code",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.countryEn,
        r.alpha3,
        r.alpha2,
        r.location,
        r.subdivisionEn,
        r.subdivisionLocal,
        r.subdivisionCode,
      ].map(csvEscape).join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function parseCsv(text: string): SubdivisionRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];
  const rows: SubdivisionRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]?.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) =>
      c.replace(/^"(.*)"$/, "$1").replace(/""/g, '"')
    );
    if (!cols) continue;
    if (cols.length < 7) continue;
    const [countryEn, alpha3, alpha2, location, subdivisionEn, subdivisionLocal, subdivisionCode] = cols;
    rows.push({
      countryEn: countryEn??'',
      alpha3: alpha3??'',
      alpha2: alpha2??'',
      location: location??'',
      subdivisionEn: subdivisionEn??'',
      subdivisionLocal: subdivisionLocal??'',
      subdivisionCode:subdivisionCode??'',
    });
  }
  return rows;
}
