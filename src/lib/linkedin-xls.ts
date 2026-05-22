import * as XLSX from "xlsx";

export type LinkedInFileType = "content" | "visitors" | "leads";

export interface ParsedMetrics {
  weeklyImpressions?: string;
  engagementRate?: string;
  monthlyVisitors?: string;
  followers?: string;
}

type Row = (string | number | boolean | null | undefined)[];

// Column header keywords that identify a LinkedIn analytics file
const LINKEDIN_SIGNALS = [
  "impressions", "clicks", "engagement", "followers",
  "visitors", "page views", "date", "leads", "shares",
];

function findHeaderRow(rows: Row[]): number {
  return rows.findIndex((row) => {
    const strs = row.filter((c): c is string => typeof c === "string");
    return LINKEDIN_SIGNALS.some((sig) =>
      strs.some((s) => s.toLowerCase().includes(sig))
    );
  });
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

  const impCol = findCol(headers, "impressions");
  const engCol = findCol(headers, "engagement rate");

  if (impCol >= 0) {
    const vs = toNums(dataRows, impCol);
    if (vs.length) {
      const avg = mean(vs);
      // If data looks daily (many rows), scale up to weekly
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

  // Prefer "Total Unique Visitors", fall back to total page views
  let col = findCol(headers, "total unique visitors");
  if (col < 0) col = findCol(headers, "unique visitors");
  if (col < 0) col = findCol(headers, "total page views");
  if (col < 0) col = findCol(headers, "page views");

  if (col >= 0) {
    const vs = toNums(dataRows, col);
    if (vs.length) {
      const total = vs.reduce((a, b) => a + b, 0);
      // Estimate how many months the export covers, then compute monthly avg
      const estimatedMonths = vs.length > 20
        ? vs.length / 30   // daily rows
        : vs.length / 4.33; // weekly rows
      m.monthlyVisitors = String(Math.round(total / Math.max(estimatedMonths, 1)));
    }
  }

  return m;
}

function parseLeads(dataRows: Row[], headers: Row): ParsedMetrics {
  const m: ParsedMetrics = {};

  // LinkedIn "Followers" export — take the most recent (last row) total follower count
  let col = findCol(headers, "total followers");
  if (col < 0) col = findCol(headers, "organic followers");
  if (col < 0) col = findCol(headers, "followers");

  if (col >= 0) {
    const vs = toNums(dataRows, col);
    if (vs.length) {
      m.followers = String(Math.round(vs[vs.length - 1]));
    }
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
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json<Row>(sheet, {
          header: 1,
          defval: null,
        });

        const hi = findHeaderRow(allRows);
        if (hi < 0) {
          reject(new Error("Couldn't find column headers. Is this a LinkedIn analytics export?"));
          return;
        }

        const headers = allRows[hi];
        const dataRows = allRows
          .slice(hi + 1)
          .filter((r) => r.some((c) => c != null && c !== ""));

        if (!dataRows.length) {
          reject(new Error("No data rows found in the file."));
          return;
        }

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
