import * as XLSX from "xlsx";

export type LinkedInFileType = "content" | "visitors" | "leads";

export interface ParsedMetrics {
  weeklyImpressions?: string;
  engagementRate?: string;
  monthlyVisitors?: string;
  followers?: string;
}

type Row = (string | number | boolean | null | undefined)[];

// Keywords that identify a LinkedIn analytics header row
const LINKEDIN_SIGNALS = [
  "impression", "click", "engag", "follower",
  "visitor", "page view", "date", "lead", "share", "reaction",
];

function isLinkedInHeader(row: Row): boolean {
  const strs = row.filter((c): c is string => typeof c === "string");
  return LINKEDIN_SIGNALS.some((sig) =>
    strs.some((s) => s.toLowerCase().includes(sig))
  );
}

// Search every sheet in the workbook; return the sheet rows that contain
// a recognisable LinkedIn header row (LinkedIn sometimes puts data on sheet 2+)
function findDataRows(wb: XLSX.WorkBook): { headers: Row; dataRows: Row[] } | null {
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const allRows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, defval: null });

    const hi = allRows.findIndex(isLinkedInHeader);
    if (hi < 0) continue;

    const headers = allRows[hi];
    const dataRows = allRows
      .slice(hi + 1)
      .filter((r) => r.some((c) => c != null && c !== ""));

    if (dataRows.length) return { headers, dataRows };
  }
  return null;
}

function findCol(headers: Row, ...terms: string[]): number {
  return headers.findIndex(
    (h) =>
      typeof h === "string" &&
      terms.some((t) => h.toLowerCase().includes(t.toLowerCase()))
  );
}

function toNums(rows: Row[], col: number): number[] {
  return rows.flatMap((r) => {
    const v = r[col];
    if (typeof v === "number" && isFinite(v)) return [v];
    if (typeof v === "string") {
      const n = parseFloat(v.replace("%", "").trim());
      if (!isNaN(n)) return [n];
    }
    return [];
  });
}

function mean(ns: number[]) {
  return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0;
}

function parseContent(dataRows: Row[], headers: Row): ParsedMetrics {
  const m: ParsedMetrics = {};

  // Try broad impression terms — LinkedIn uses "Impressions", "Impressions (total)",
  // "Total impressions", "Organic impressions", etc.
  const impCol = findCol(headers, "impression");
  // Try broad engagement terms
  const engCol = findCol(headers, "engagement rate", "engagement %", "engag");

  if (impCol >= 0) {
    const vs = toNums(dataRows, impCol);
    if (vs.length) {
      const avg = mean(vs);
      // Many rows → daily data; scale up to weekly. Few rows → weekly/per-post; use avg directly.
      const weeklyImp = vs.length > 20 ? Math.round(avg * 7) : Math.round(avg);
      m.weeklyImpressions = String(weeklyImp);
    }
  }

  if (engCol >= 0) {
    const vs = toNums(dataRows, engCol);
    if (vs.length) {
      const avg = mean(vs);
      // LinkedIn exports rate as decimal (0.023) or percent (2.3) — normalise to %
      const pct = avg <= 1 ? avg * 100 : avg;
      m.engagementRate = pct.toFixed(2);
    }
  }

  return m;
}

function parseVisitors(dataRows: Row[], headers: Row): ParsedMetrics {
  const m: ParsedMetrics = {};

  // Prefer most-specific match first to avoid picking up "Desktop Unique Visitors"
  let col = findCol(headers, "total unique visitor");
  if (col < 0) col = findCol(headers, "unique visitor");
  if (col < 0) col = findCol(headers, "total page view");
  if (col < 0) col = findCol(headers, "page view");

  if (col >= 0) {
    const vs = toNums(dataRows, col);
    if (vs.length) {
      const total = vs.reduce((a, b) => a + b, 0);
      // Estimate months covered: >20 rows → daily, ≤20 → weekly
      const estimatedMonths = vs.length > 20 ? vs.length / 30 : vs.length / 4.33;
      m.monthlyVisitors = String(Math.round(total / Math.max(estimatedMonths, 1)));
    }
  }

  return m;
}

function parseLeads(dataRows: Row[], headers: Row): ParsedMetrics {
  const m: ParsedMetrics = {};

  let col = findCol(headers, "total followers");
  if (col < 0) col = findCol(headers, "organic followers");
  if (col < 0) col = findCol(headers, "follower");

  if (col >= 0) {
    const vs = toNums(dataRows, col);
    // Take the last non-zero value as the most recent follower count
    const recent = [...vs].reverse().find((v) => v > 0);
    if (recent !== undefined) m.followers = String(Math.round(recent));
  }

  return m;
}

export async function parseLinkedInFile(
  file: File,
  type: LinkedInFileType
): Promise<ParsedMetrics> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });

        const found = findDataRows(wb);
        if (!found) {
          reject(new Error("Couldn't find column headers across any sheet. Is this a LinkedIn analytics export?"));
          return;
        }

        const { headers, dataRows } = found;

        const metrics =
          type === "content" ? parseContent(dataRows, headers) :
          type === "visitors" ? parseVisitors(dataRows, headers) :
          parseLeads(dataRows, headers);

        if (!Object.keys(metrics).length) {
          reject(
            new Error(
              `Expected columns not found. Make sure this is the ${type} analytics export from LinkedIn.`
            )
          );
          return;
        }

        resolve(metrics);
      } catch {
        reject(new Error("Failed to parse the file. Is it a valid LinkedIn analytics export?"));
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}
