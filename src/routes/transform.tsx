import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, Copy, Download, FileText, Film, History, MessageSquare, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import { AppShell } from "@/components/spectr/AppShell";
import { transformContent, type TransformInput } from "@/lib/transform-fn";
import supabase from "@/lib/supabase";

export const Route = createFileRoute("/transform")({ component: TransformPage });

type TabKey = "Article" | "Post" | "Video Script";

const TABS: { key: TabKey; label: string }[] = [
  { key: "Article", label: "Article" },
  { key: "Post", label: "Posts" },
  { key: "Video Script", label: "Video Script" },
];

const JSON_KEY: Record<TabKey, string> = {
  Article: "article",
  Post: "posts",
  "Video Script": "videoScript",
};

interface Source {
  content?: string;
  pdfBase64?: string;
  context: string;
}

function TransformPage() {
  return <AppShell><Transform /></AppShell>;
}

// --- Content renderers ---

function safeExtract(text: string, tab: TabKey): string {
  const key = JSON_KEY[tab];
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("```")) {
    try {
      const cleaned = trimmed.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === "object" && key in parsed && typeof parsed[key] === "string") {
        return parsed[key];
      }
    } catch {}
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        if (parsed && typeof parsed === "object" && key in parsed && typeof parsed[key] === "string") {
          return parsed[key];
        }
      } catch {}
    }
  }
  return text;
}

function ArticleView({ text }: { text: string }) {
  const nl = text.indexOf("\n");
  const headline = nl >= 0 ? text.slice(0, nl).trim() : text.trim();
  const body = nl >= 0 ? text.slice(nl + 1).trim() : "";
  const paragraphs = body.split(/\n\n+/).filter(Boolean);
  return (
    <div>
      {headline && (
        <h2 className="text-lg font-bold mb-5 leading-snug">{headline}</h2>
      )}
      {paragraphs.map((para, i) => (
        <p key={i} className="mb-4 text-sm leading-7 whitespace-pre-wrap">
          {para.trim()}
        </p>
      ))}
    </div>
  );
}

function PostsView({ text }: { text: string }) {
  const posts = text.split(/\n\s*---\s*\n|(?:^|\n)---(?:\n|$)/m).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {posts.map((post, i) => (
        <div
          key={i}
          className="p-4 rounded-lg border"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          <div
            className="text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: "var(--color-primary)" }}
          >
            Post {i + 1}
          </div>
          <p className="text-sm leading-6 whitespace-pre-wrap">{post}</p>
        </div>
      ))}
    </div>
  );
}

function VideoScriptView({ text }: { text: string }) {
  const sectionRe = /(\[[A-Z][A-Z\s0-9]*\d+:\d+\])/g;
  const parts = text.split(sectionRe).filter((p) => p.trim());
  const labelRe = /^\[[A-Z][A-Z\s0-9]*\d+:\d+\]$/;

  if (parts.length <= 1) {
    return <p className="text-sm leading-7 whitespace-pre-wrap">{text}</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {parts.map((part, i) => {
        const clean = part.trim();
        if (!clean) return null;
        if (labelRe.test(clean)) {
          return (
            <div key={i} className="mt-4 first:mt-0">
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide"
                style={{ background: "var(--color-primary)", color: "white", boxShadow: "var(--glow-primary-sm)" }}
              >
                {clean.slice(1, -1)}
              </span>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm leading-7 whitespace-pre-wrap ml-1">
            {clean}
          </p>
        );
      })}
    </div>
  );
}

function ContentRenderer({ tab, text }: { tab: TabKey; text: string }) {
  const clean = safeExtract(text, tab);
  if (tab === "Article") return <ArticleView text={clean} />;
  if (tab === "Post") return <PostsView text={clean} />;
  return <VideoScriptView text={clean} />;
}

async function readFile(file: File): Promise<{ text?: string; pdfBase64?: string }> {
  const name = file.name.toLowerCase();
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
  const isDocx =
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (isPdf) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const bytes = new Uint8Array(e.target!.result as ArrayBuffer);
        let binary = "";
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        resolve({ pdfBase64: btoa(binary) });
      };
      reader.onerror = () => reject(new Error("Failed to read PDF."));
      reader.readAsArrayBuffer(file);
    });
  }

  if (isDocx) {
    const mammoth = await import("mammoth");
    const buffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
    return { text: value };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve({ text: e.target!.result as string });
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

function triggerDl(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildFilename(companyName: string, userName: string, tab: TabKey, ext: string): string {
  const co = (companyName || "Company").replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  const user = (userName || "User").split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  const type = tab === "Post" ? "Posts" : tab.replace(/\s+/g, "");
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "short" });
  return `${co}-${user}-${type}-${month}${now.getDate()}.${ext}`;
}

async function dlPdf(tab: TabKey, content: string, filename: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ML = 20, MT = 25, CW = 170;
  let y = MT;

  const ensureSpace = (n: number) => { if (y + n > 282) { doc.addPage(); y = MT; } };

  if (tab === "Article") {
    const nl = content.indexOf("\n");
    const headline = (nl >= 0 ? content.slice(0, nl) : content).trim();
    const body = (nl >= 0 ? content.slice(nl + 1) : "").trim();

    // Title
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(10, 102, 194);
    for (const line of doc.splitTextToSize(headline, CW) as string[]) {
      ensureSpace(13); doc.text(line, ML, y); y += 13;
    }
    y += 1;
    doc.setDrawColor(10, 102, 194); doc.setLineWidth(0.6); doc.line(ML, y, ML + CW, y); y += 9;

    // Body paragraphs
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
    for (const para of body.split(/\n\n+/).filter(Boolean)) {
      for (const line of doc.splitTextToSize(para.trim(), CW) as string[]) {
        ensureSpace(7); doc.text(line, ML, y); y += 7;
      }
      y += 5;
    }

  } else if (tab === "Post") {
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(10, 102, 194);
    doc.text("Posts", ML, y); y += 5;
    doc.setDrawColor(10, 102, 194); doc.setLineWidth(0.6); doc.line(ML, y, ML + CW, y); y += 10;

    // Unicode bullets (→ • ▸ ◦ etc.) are outside Helvetica's Latin encoding — replace with ASCII
    const bulletRe = /^[→•▪◦‣⁃●▸∙*]\s*/;

    const posts = content.split(/\n\s*---\s*\n|(?:^|\n)---(?:\n|$)/m).map((p) => p.trim()).filter(Boolean);
    for (let i = 0; i < posts.length; i++) {
      const rows: { text: string; x: number }[] = [];
      for (const raw of posts[i].split('\n')) {
        const t = raw.trim();
        const m = t.match(bulletRe);
        if (m) {
          const rest = t.slice(m[0].length).trim();
          const wrapped = doc.splitTextToSize(rest, CW - 18) as string[];
          rows.push({ text: '- ' + wrapped[0], x: ML + 5 });
          for (let wi = 1; wi < wrapped.length; wi++) rows.push({ text: wrapped[wi], x: ML + 11 });
        } else if (t) {
          for (const wl of doc.splitTextToSize(t, CW - 10) as string[]) rows.push({ text: wl, x: ML + 5 });
        } else {
          rows.push({ text: '', x: ML + 5 });
        }
      }

      const boxH = 10 + rows.length * 7 + 8;
      ensureSpace(boxH);

      doc.setDrawColor(200, 218, 240); doc.setLineWidth(0.4); doc.rect(ML, y, CW, boxH);
      doc.setFillColor(10, 102, 194); doc.rect(ML, y, CW, 9, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
      doc.text(`POST ${i + 1}`, ML + 4, y + 6.2);

      doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
      let ty = y + 17;
      for (const row of rows) { doc.text(row.text, row.x, ty); ty += 7; }
      y += boxH + 6;
    }

  } else {
    // Video Script
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(10, 102, 194);
    doc.text("Video Script", ML, y); y += 5;
    doc.setDrawColor(10, 102, 194); doc.setLineWidth(0.6); doc.line(ML, y, ML + CW, y); y += 12;

    const sectionRe = /(\[[A-Z][A-Z\s0-9]*\d+:\d+\])/g;
    const labelRe = /^\[[A-Z][A-Z\s0-9]*\d+:\d+\]$/;

    for (const part of content.split(sectionRe).filter((p) => p.trim())) {
      const clean = part.trim(); if (!clean) continue;
      if (labelRe.test(clean)) {
        const label = clean.slice(1, -1);
        ensureSpace(14);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        const tw = label.length * 2.2 + 10;
        doc.setFillColor(10, 102, 194); doc.roundedRect(ML, y - 5.5, tw, 8, 2, 2, "F");
        doc.setTextColor(255, 255, 255); doc.text(label, ML + 5, y);
        doc.setTextColor(30, 30, 30); y += 11;
      } else {
        doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
        for (const line of doc.splitTextToSize(clean, CW - 8) as string[]) {
          ensureSpace(7); doc.text(line, ML + 4, y); y += 7;
        }
        y += 5;
      }
    }
  }

  doc.save(filename);
}

async function dlDocx(tab: TabKey, content: string, filename: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, ShadingType } = await import("docx");
  const children: InstanceType<typeof Paragraph>[] = [];

  if (tab === "Article") {
    const nl = content.indexOf("\n");
    const headline = (nl >= 0 ? content.slice(0, nl) : content).trim();
    const body = (nl >= 0 ? content.slice(nl + 1) : "").trim();

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: headline, bold: true, color: "0A66C2" })],
      spacing: { after: 320 },
    }));
    for (const para of body.split(/\n\n+/).filter(Boolean)) {
      children.push(new Paragraph({
        children: [new TextRun({ text: para.trim(), size: 24 })],
        spacing: { after: 160, line: 352 },
      }));
    }

  } else if (tab === "Post") {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Posts", bold: true, color: "0A66C2" })],
      spacing: { after: 400 },
    }));

    const posts = content.split(/\n\s*---\s*\n|(?:^|\n)---(?:\n|$)/m).map((p) => p.trim()).filter(Boolean);
    posts.forEach((post, i) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `Post ${i + 1}`, bold: true, color: "0A66C2", size: 22 })],
        spacing: { before: i > 0 ? 500 : 0, after: 100 },
        border: { left: { style: BorderStyle.THICK, size: 20, color: "0A66C2" } },
        indent: { left: 280 },
      }));
      for (const line of post.split("\n")) {
        children.push(new Paragraph({
          children: [new TextRun({ text: line || " ", size: 24 })],
          spacing: { after: 80, line: 330 },
          border: { left: { style: BorderStyle.THICK, size: 20, color: "0A66C2" } },
          indent: { left: 280 },
        }));
      }
    });

  } else {
    // Video Script
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Video Script", bold: true, color: "0A66C2" })],
      spacing: { after: 400 },
    }));

    const sectionRe = /(\[[A-Z][A-Z\s0-9]*\d+:\d+\])/g;
    const labelRe = /^\[[A-Z][A-Z\s0-9]*\d+:\d+\]$/;

    for (const part of content.split(sectionRe).filter((p) => p.trim())) {
      const clean = part.trim(); if (!clean) continue;
      if (labelRe.test(clean)) {
        children.push(new Paragraph({
          children: [new TextRun({ text: clean.slice(1, -1), bold: true, color: "FFFFFF", size: 20 })],
          shading: { type: ShadingType.CLEAR, fill: "0A66C2", color: "auto" },
          spacing: { before: 360, after: 140 },
        }));
      } else {
        for (const line of clean.split("\n").filter(Boolean)) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line, size: 24 })],
            spacing: { after: 100, line: 340 },
            indent: { left: 360 },
          }));
        }
        children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
      }
    }
  }

  const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
  triggerDl(blob, filename);
}

// --- Skeleton ---

function Bone({ w = "100%", h = 14, className = "" }: { w?: string | number; h?: number; className?: string }) {
  return (
    <div
      className={`rounded-md animate-pulse ${className}`}
      style={{ width: w, height: h, background: "var(--color-border)" }}
    />
  );
}

function SkeletonOutput({ tab }: { tab: TabKey }) {
  if (tab === "Article") {
    return (
      <div className="spectr-card p-5">
        {/* toolbar row */}
        <div className="flex items-center justify-between mb-5">
          <Bone w={80} h={16} />
          <div className="flex gap-2">
            <Bone w={64} h={30} /><Bone w={64} h={30} /><Bone w={64} h={30} />
          </div>
        </div>
        {/* headline */}
        <Bone w="70%" h={22} className="mb-6" />
        {/* body paragraphs */}
        {[100, 90, 95, 85, 100, 80, 92, 88, 75, 96, 83].map((w, i) => (
          <Bone key={i} w={`${w}%`} h={13} className="mb-3" />
        ))}
        <Bone w="40%" h={13} className="mb-6" />
        {/* second block */}
        {[100, 88, 95, 79].map((w, i) => (
          <Bone key={i} w={`${w}%`} h={13} className="mb-3" />
        ))}
      </div>
    );
  }

  if (tab === "Post") {
    return (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="spectr-card p-4">
            <Bone w={48} h={11} className="mb-3" />
            {[100, 92, 85, 96, 78, 88].map((w, j) => (
              <Bone key={j} w={`${w}%`} h={12} className="mb-2.5" />
            ))}
            <Bone w="55%" h={12} />
          </div>
        ))}
      </div>
    );
  }

  // Video Script
  return (
    <div className="spectr-card p-5">
      <div className="flex items-center justify-between mb-5">
        <Bone w={90} h={16} />
        <div className="flex gap-2">
          <Bone w={64} h={30} /><Bone w={64} h={30} />
        </div>
      </div>
      {[
        { label: true, lines: [100, 88, 75] },
        { label: true, lines: [96, 82, 90, 70] },
        { label: true, lines: [100, 85, 78] },
        { label: true, lines: [92, 80] },
        { label: true, lines: [88, 95, 72] },
      ].map((section, i) => (
        <div key={i} className="mt-4 first:mt-0">
          <Bone w={110} h={22} className="mb-3 rounded-full" />
          {section.lines.map((w, j) => (
            <Bone key={j} w={`${w}%`} h={12} className="mb-2.5 ml-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// --- Circular progress ---

function CircularProgress({ pct }: { pct: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={108} height={108} viewBox="0 0 108 108" className="spectr-heartbeat" style={{ transformOrigin: "54px 54px" }}>
      <circle cx={54} cy={54} r={r} fill="none" stroke="#E8EDF2" strokeWidth={8} />
      <circle
        cx={54} cy={54} r={r} fill="none"
        stroke="var(--color-primary)" strokeWidth={8} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 54 54)"
        style={{ transition: "stroke-dashoffset 0.35s ease" }}
      />
      <text x={54} y={60} textAnchor="middle" fontSize={17} fontWeight={700} fill="white" fontFamily="Inter, sans-serif">
        {pct}%
      </text>
    </svg>
  );
}

// --- Generation history ---

interface HistoryEntry {
  id: string;
  format: TabKey;
  content: string;
  created_at: string;
}

const FORMAT_ICONS: Record<TabKey, React.ReactNode> = {
  Article: <FileText size={13} />,
  Post: <MessageSquare size={13} />,
  "Video Script": <Film size={13} />,
};

function formatEntryDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: diffDays > 300 ? "numeric" : undefined });
}

function HistoryPanel({ entries, onLoad, onClose }: { entries: HistoryEntry[]; onLoad: (e: HistoryEntry) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} style={{ background: "rgba(0,0,0,0.18)" }} />
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{ width: 348, background: "var(--color-card)", boxShadow: "-4px 0 32px rgba(0,0,0,0.5)", borderLeft: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <History size={15} style={{ color: "var(--color-primary)" }} />
            <h3 className="font-bold text-sm">Generation History</h3>
          </div>
          <button onClick={onClose} className="hover:opacity-60 transition-opacity" style={{ color: "var(--color-text-secondary)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center" style={{ color: "var(--color-text-secondary)" }}>
              <History size={32} className="mb-3 opacity-25" />
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>No history yet</p>
              <p className="text-xs">Generated content will appear here. Up to 10 entries are saved per company.</p>
            </div>
          ) : (
            <div>
              {entries.map((entry) => {
                const raw = safeExtract(entry.content, entry.format);
                const preview = raw.replace(/\n+/g, " ").trim().slice(0, 100);
                return (
                  <button
                    key={entry.id}
                    onClick={() => onLoad(entry)}
                    className="w-full text-left px-5 py-4 border-b transition-colors hover:bg-[var(--color-card-2)]"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span style={{ color: "var(--color-primary)" }}>{FORMAT_ICONS[entry.format]}</span>
                      <span className="text-xs font-bold" style={{ color: "var(--color-primary)" }}>
                        {entry.format === "Post" ? "Posts" : entry.format}
                      </span>
                      <span className="text-xs ml-auto shrink-0" style={{ color: "var(--color-text-secondary)" }}>
                        {formatEntryDate(entry.created_at)}
                      </span>
                    </div>
                    <p className="text-xs leading-[1.55]" style={{ color: "var(--color-text-secondary)" }}>
                      {preview}{raw.length > 100 ? "..." : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t text-center shrink-0" style={{ borderColor: "var(--color-border)" }}>
          <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
            Last 10 generations for this company
          </p>
        </div>
      </div>
    </>
  );
}

// --- Saved contexts ---

interface SavedCtx { id: string; name: string; text: string; }

function TabBar({ tab, setTab, tabBusy }: { tab: TabKey; setTab: (t: TabKey) => void; tabBusy: TabKey | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-tab="${tab}"]`) as HTMLElement | null;
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab]);

  return (
    <div
      ref={containerRef}
      className="relative flex px-6"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      {TABS.map((t) => (
        <button
          key={t.key}
          data-tab={t.key}
          onClick={() => setTab(t.key)}
          className="px-4 py-3 text-sm font-semibold flex items-center gap-2 transition-colors duration-150"
          style={{ color: tab === t.key ? "var(--color-primary)" : "var(--color-text-secondary)" }}
        >
          {t.label}
          {tabBusy === t.key && (
            <span
              className="inline-block rounded-full animate-spin"
              style={{ width: 10, height: 10, border: "2px solid var(--color-border)", borderTopColor: "var(--color-primary)" }}
            />
          )}
        </button>
      ))}
      {/* Sliding indicator */}
      <div
        className="absolute bottom-0 h-0.5"
        style={{
          left: indicator.left,
          width: indicator.width,
          background: "var(--color-primary)",
          boxShadow: "var(--glow-primary-sm)",
          transition: "left 0.2s cubic-bezier(0.4,0,0.2,1), width 0.2s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </div>
  );
}

function Transform() {
  const { state } = useApp();
  const ws = state.workspace;

  const [context, setContext] = useState("");
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  // Pre-populate from Record page via sessionStorage
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingTranscript");
    if (pending) {
      setText(pending);
      sessionStorage.removeItem("pendingTranscript");
    }
  }, []);
  const [loading, setLoading] = useState(false);
  const [outputs, setOutputs] = useState<Partial<Record<TabKey, string>>>({});
  const [tab, setTab] = useState<TabKey>("Article");
  const [refineInput, setRefineInput] = useState<Partial<Record<TabKey, string>>>({});
  const [source, setSource] = useState<Source | null>(null);
  const [tabBusy, setTabBusy] = useState<TabKey | null>(null);
  const [progress, setProgress] = useState(0);
  const cancelledRef = useRef(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const outputScrollRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [savedCtxs, setSavedCtxs] = useState<SavedCtx[]>([]);
  const [showCtxMenu, setShowCtxMenu] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);

  // Load saved contexts from Supabase on mount
  useEffect(() => {
    const userId = state.user?.id;
    if (!userId) return;
    supabase
      .from("saved_contexts")
      .select("id, name, text")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => { if (data) setSavedCtxs(data as SavedCtx[]); });
  }, [state.user?.id]);

  // Reload history when active company changes
  useEffect(() => {
    setHistoryEntries([]);
  }, [ws.companyId]);

  useEffect(() => {
    if (!showCtxMenu) return;
    const handler = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setShowCtxMenu(false);
        setShowSaveInput(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCtxMenu]);

  const fetchHistory = async () => {
    const companyId = ws.companyId;
    const userId = state.user?.id;
    if (!companyId || !userId) return;
    const { data, error } = await supabase
      .from("generations")
      .select("id, format, content, created_at")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) { console.error("History fetch error:", error); return; }
    setHistoryEntries((data as HistoryEntry[]) ?? []);
  };

  const saveCurrentCtx = async () => {
    const userId = state.user?.id;
    if (!saveName.trim() || !instructions.trim() || !userId) return;
    const { data, error } = await supabase
      .from("saved_contexts")
      .insert({ user_id: userId, name: saveName.trim(), text: instructions.trim() })
      .select("id, name, text")
      .single();
    if (error) { toast.error("Failed to save context."); return; }
    setSavedCtxs((prev) => [data as SavedCtx, ...prev]);
    setSaveName("");
    setShowSaveInput(false);
    toast.success("Context saved.");
  };

  const deleteCtx = async (id: string) => {
    const { error } = await supabase.from("saved_contexts").delete().eq("id", id);
    if (error) { toast.error("Failed to delete context."); return; }
    setSavedCtxs((prev) => prev.filter(c => c.id !== id));
  };

  const hasAnyOutput = Object.keys(outputs).length > 0;
  const showOutput = hasAnyOutput || loading;

  const wsPayload = useMemo(
    () => ({
      companyName: ws.companyName,
      industry: ws.industry,
      goalDescription: ws.goalDescription,
      audience: ws.audience,
    }),
    [ws]
  );

  const banner = useMemo(() => {
    const titles = ws.audience.jobTitles || "your audience";
    const size = ws.audience.companySize || "all-size";
    const ind = ws.industry || "your industry";
    return `Targeting: ${titles} at ${size} companies in ${ind}`;
  }, [ws]);

  async function callTransform(input: TransformInput) {
    const data = await transformContent({ data: input });
    if (data.error) throw new Error(data.error);
    return data;
  }

  const cancelTransform = () => {
    cancelledRef.current = true;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setLoading(false);
    setProgress(0);
  };

  const transform = async () => {
    if (!file && !text.trim()) {
      setError("Please upload a document or paste your content.");
      return;
    }
    setError("");
    cancelledRef.current = false;
    setProgress(0);
    setLoading(true);
    outputScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    leftPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" });

    // Simulate progress up to 90% while waiting for the API
    let p = 0;
    progressTimerRef.current = setInterval(() => {
      p += Math.random() * 4 + 1;
      if (p >= 90) { p = 90; clearInterval(progressTimerRef.current!); }
      setProgress(Math.round(p));
    }, 350);

    try {
      const fileContent = file ? await readFile(file) : {};
      if (cancelledRef.current) return;
      const content = (fileContent as any).text ?? text;
      const pdfBase64 = (fileContent as any).pdfBase64;
      const src: Source = { content, pdfBase64, context };
      setSource(src);

      const data = await callTransform({ format: tab, content, pdfBase64, context, instructions, workspace: wsPayload });
      if (cancelledRef.current) return;

      clearInterval(progressTimerRef.current!);
      setProgress(100);
      const jk = JSON_KEY[tab];
      const generated = (data[jk as keyof typeof data] as string) ?? "";
      setOutputs((o) => ({ ...o, [tab]: generated }));

      // Save to history immediately — capture IDs before any re-render
      const companyId = ws.companyId;
      const userId = state.user?.id;
      if (companyId && userId && generated.trim()) {
        const { error: insertErr } = await supabase
          .from("generations")
          .insert({ company_id: companyId, user_id: userId, format: tab, content: generated });
        if (insertErr) {
          console.error("History save error:", insertErr);
        } else {
          // Trim to 10 oldest entries for this company
          const { data: all } = await supabase
            .from("generations")
            .select("id")
            .eq("company_id", companyId)
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
          if (all && all.length > 10) {
            await supabase.from("generations").delete().in("id", all.slice(10).map((r: any) => r.id));
          }
        }
      }
    } catch (err: any) {
      if (!cancelledRef.current) setError(err.message ?? "Generation failed. Please try again.");
    } finally {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setLoading(false);
      setProgress(0);
    }
  };

  const regen = async (key: TabKey) => {
    if (!source) return;
    setTabBusy(key);
    try {
      const data = await callTransform({
        format: key,
        regenerate: true,
        content: source.content,
        pdfBase64: source.pdfBase64,
        context: source.context,
        instructions,
        workspace: wsPayload,
      });
      const jk = JSON_KEY[key];
      setOutputs((o) => (o ? { ...o, [key]: data[jk as keyof typeof data] ?? o[key] } : o));
      toast.success("Regenerated");
    } catch (err: any) {
      toast.error(err.message ?? "Regeneration failed.");
    } finally {
      setTabBusy(null);
    }
  };

  const refine = async (key: TabKey) => {
    const note = refineInput[key]?.trim();
    if (!note || !outputs) return;
    setTabBusy(key);
    try {
      const data = await callTransform({
        refine: true,
        format: key,
        existingContent: outputs[key],
        note,
        context,
        instructions,
        workspace: wsPayload,
      });
      const jk = JSON_KEY[key];
      setOutputs((o) => (o ? { ...o, [key]: data[jk as keyof typeof data] ?? o[key] } : o));
      setRefineInput((r) => ({ ...r, [key]: "" }));
      toast.success("Output refined");
    } catch (err: any) {
      toast.error(err.message ?? "Refinement failed.");
    } finally {
      setTabBusy(null);
    }
  };

  const copy = (key: TabKey) => {
    if (!outputs[key]) return;
    navigator.clipboard.writeText(outputs[key]!);
    toast.success("Copied to clipboard");
  };

  const activeTabBusy = tabBusy === tab;

  const loadFromHistory = (entry: HistoryEntry) => {
    setOutputs((o) => ({ ...o, [entry.format]: entry.content }));
    setTab(entry.format);
    setShowHistory(false);
    setTimeout(() => outputScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  return (
    <div className="flex h-screen">
      {showHistory && (
        <HistoryPanel
          entries={historyEntries}
          onLoad={loadFromHistory}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* LEFT PANEL - full width before any output, 2/5 once output exists */}
      <div
        ref={leftPanelRef}
        className={`${showOutput ? "w-2/5 border-r" : "w-full"} overflow-y-auto relative`}
        style={{ borderColor: "var(--color-border)" }}
      >
        {/* Upload/processing overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(2px)" }}>
            <div
              className="flex flex-col items-center px-10 py-9 rounded-2xl"
              style={{ border: "2px dashed var(--color-border)", background: "var(--color-card-2)", minWidth: 220 }}
            >
              <CircularProgress pct={progress} />
              <p className="text-sm font-semibold mt-4 mb-5">
                {progress < 15 ? "Reading file..." : "Generating content..."}
              </p>
              <button onClick={cancelTransform} className="spectr-btn-secondary" style={{ height: 34 }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="p-6 pb-8">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold">Transform</h1>
            <button
              onClick={() => { setShowHistory(true); fetchHistory(); }}
              className="spectr-btn-secondary flex items-center gap-1.5"
              style={{ height: 32, padding: "0 12px", fontSize: 12 }}
            >
              <History size={13} /> History
            </button>
          </div>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
            Drop in a transcript, notes, or a document and get publish-ready content.
          </p>

          <label className="spectr-label">Output Type</label>
          <div className="flex gap-2 mb-5">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="flex-1 py-2 text-xs font-semibold rounded-md transition-colors"
                  style={{
                    background: active ? "var(--color-primary)" : "var(--color-card-2)",
                    color: active ? "white" : "var(--color-text-secondary)",
                    border: `1.5px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                    boxShadow: active ? "var(--glow-primary-sm)" : "none",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <label className="spectr-label">Add context (optional)</label>
          <textarea
            rows={3}
            className="spectr-textarea mb-5"
            placeholder=""
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />

          <label className="spectr-label">Content Instructions (optional)</label>
          <p className="text-xs mb-1" style={{ color: "var(--color-text-secondary)" }}>
            Control the shape and length of the output - e.g. <em>5 minutes long</em>, <em>1500 words</em>, <em>4 pillars</em>, <em>include a case study</em>
          </p>
          <textarea
            rows={4}
            className="spectr-textarea mb-2"
            placeholder=""
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />

          {/* Save / Load row */}
          <div className="flex items-center gap-2 mb-5" ref={ctxMenuRef}>
            <button
              type="button"
              onClick={() => { if (instructions.trim()) setShowSaveInput(v => !v); else toast.error("Add instructions first."); }}
              className="spectr-btn-secondary flex items-center gap-1.5"
              style={{ height: 30, padding: "0 12px", fontSize: 12 }}
            >
              <Bookmark size={12} /> Save
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCtxMenu(v => !v)}
                className="spectr-btn-secondary flex items-center gap-1.5"
                style={{ height: 30, padding: "0 12px", fontSize: 12 }}
              >
                {savedCtxs.length > 0 ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                Load saved
                {savedCtxs.length > 0 && (
                  <span className="rounded-full text-[10px] px-1.5 font-bold" style={{ background: "var(--color-primary)", color: "white", boxShadow: "var(--glow-primary-sm)" }}>
                    {savedCtxs.length}
                  </span>
                )}
              </button>

              {showCtxMenu && (
                <div
                  className="absolute left-0 top-full mt-1 w-72 rounded-xl z-50 overflow-hidden"
                  style={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
                >
                  {savedCtxs.length === 0 ? (
                    <p className="text-xs px-4 py-4 text-center" style={{ color: "var(--color-text-secondary)" }}>
                      No saved contexts yet.
                    </p>
                  ) : savedCtxs.map(c => (
                    <div key={c.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-[rgba(255,255,255,0.06)] group">
                      <button
                        className="flex-1 text-left text-xs font-medium truncate"
                        onClick={() => { setInstructions(c.text); setShowCtxMenu(false); toast.success(`Loaded "${c.name}"`); }}
                      >
                        {c.name}
                      </button>
                      <button
                        onClick={() => deleteCtx(c.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showSaveInput && (
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  autoFocus
                  className="spectr-input flex-1"
                  style={{ height: 30, fontSize: 12 }}
                  placeholder="Name this context..."
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveCurrentCtx()}
                />
                <button onClick={saveCurrentCtx} className="spectr-btn-primary" style={{ height: 30, padding: "0 12px", fontSize: 12 }}>
                  Save
                </button>
                <button onClick={() => { setShowSaveInput(false); setSaveName(""); }} style={{ color: "var(--color-text-secondary)" }}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          <label className="cursor-pointer mb-3 block">
            <div
              className="rounded-md p-6 text-center"
              style={{ border: `2px dashed var(--color-border)`, background: "var(--color-surface)" }}
            >
              {!file ? (
                <>
                  <Upload size={24} className="mx-auto mb-2" style={{ color: "var(--color-text-secondary)" }} />
                  <div className="text-sm font-semibold">Upload a document</div>
                  <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    PDF, DOCX, or TXT
                  </div>
                </>
              ) : (
                <div
                  className="flex items-center justify-between p-2 rounded bg-white border"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="flex items-center gap-2 text-sm truncate">
                    <FileText size={16} style={{ color: "var(--color-primary)" }} />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); setFile(null); }}>
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
            <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
          </div>

          <textarea
            rows={10}
            className="spectr-textarea mb-5"
            placeholder="Paste your transcript, notes, or draft here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!!file}
            style={{ opacity: file ? 0.4 : 1 }}
          />

          {error && <p className="field-error mb-3">{error}</p>}

          <button onClick={transform} disabled={loading} className="spectr-btn-primary w-full">
            {loading ? "Generating…" : `Generate ${tab === "Post" ? "Posts" : tab}`}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL - only mounts after first generate */}
      {showOutput && (
        <div className="w-3/5 flex flex-col overflow-hidden">
          <div
            className="px-6 py-2 text-xs font-semibold border-b"
            style={{
              color: "var(--color-primary)",
              borderColor: "var(--color-border)",
            }}
          >
            {banner}
          </div>

          <TabBar tab={tab} setTab={setTab} tabBusy={tabBusy} />

          <div ref={outputScrollRef} className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <SkeletonOutput tab={tab} />
            ) : outputs[tab] ? (
              <div key={tab + outputs[tab]!.slice(0, 40)} className="spectr-card p-5 spectr-content-in">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="font-bold">{tab === "Post" ? "Posts" : tab}</h2>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => copy(tab)} className="spectr-btn-secondary" style={{ height: 32 }}>
                      <Copy size={14} className="inline mr-1" />Copy
                    </button>
                    <button onClick={() => regen(tab)} disabled={activeTabBusy} className="spectr-btn-secondary" style={{ height: 32 }}>
                      <RefreshCw size={14} className={`inline mr-1 ${activeTabBusy ? "animate-spin" : ""}`} />
                      Regenerate
                    </button>
                    <button
                      onClick={() => {
                        const clean = safeExtract(outputs[tab]!, tab);
                        dlDocx(tab, clean, buildFilename(ws.companyName, state.user?.name ?? "", tab, "docx"));
                      }}
                      className="spectr-btn-secondary" style={{ height: 32 }}
                    >
                      <Download size={14} className="inline mr-1" />DOCX
                    </button>
                    <button
                      onClick={() => {
                        const clean = safeExtract(outputs[tab]!, tab);
                        dlPdf(tab, clean, buildFilename(ws.companyName, state.user?.name ?? "", tab, "pdf"));
                      }}
                      className="spectr-btn-secondary" style={{ height: 32 }}
                    >
                      <Download size={14} className="inline mr-1" />PDF
                    </button>
                  </div>
                </div>
                <ContentRenderer tab={tab} text={outputs[tab]!} />
                <div className="mt-5 pt-4 border-t flex gap-2" style={{ borderColor: "var(--color-border)" }}>
                  <input
                    className="spectr-input flex-1"
                    placeholder=""
                    value={refineInput[tab] ?? ""}
                    onChange={(e) => setRefineInput((r) => ({ ...r, [tab]: e.target.value }))}
                  />
                  <button onClick={() => refine(tab)} disabled={activeTabBusy} className="spectr-btn-primary">
                    Refine
                  </button>
                </div>
              </div>
            ) : (
              <div className="spectr-card p-5 flex flex-col items-center justify-center py-16">
                <p className="text-sm font-semibold mb-1">{tab === "Post" ? "Posts" : tab} not generated yet</p>
                <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  Switch to <strong>{tab === "Post" ? "Posts" : tab}</strong> on the left and click Generate.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
