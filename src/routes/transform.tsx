import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, FileText, RefreshCw, Trash2, X, LogOut, History, ChevronsUpDown, Bell, Save, Upload, Sparkles, Target, MessageSquare, Video, House, Mic, ChartNoAxesColumn, Calendar, Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import { transformContent, type TransformInput } from "@/lib/transform-fn";
import supabase from "@/lib/supabase";

export const Route = createFileRoute("/transform")({ component: TransformPage });

type TabKey = "Article" | "Post" | "Video Script";

const TABS: { key: TabKey; label: string; designLabel: string }[] = [
  { key: "Article", label: "Article", designLabel: "Article" },
  { key: "Post", label: "Posts", designLabel: "Posts" },
  { key: "Video Script", label: "Video Script", designLabel: "Video Script" },
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

// --- Nav ---

const NAV_ITEMS: { label: string; to: string; icon: LucideIcon; active?: boolean }[] = [
  { label: "Growth", to: "/", icon: House },
  { label: "Transform", to: "/transform", icon: Sparkles, active: true },
  { label: "Record", to: "/record", icon: Mic },
  { label: "Results", to: "/results", icon: ChartNoAxesColumn },
  { label: "Distribute", to: "/distribute", icon: Calendar },
  { label: "Settings", to: "/settings", icon: SettingsIcon },
];

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
        <h2 style={{ margin: "26px 0 0", fontSize: 26, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.25, color: "#ffffff" }}>{headline}</h2>
      )}
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {paragraphs.map((para, i) => (
          <p key={i} style={{ margin: 0, fontSize: 15.5, lineHeight: 1.72, color: "rgba(255,255,255,0.95)", whiteSpace: "pre-wrap" }}>
            {para.trim()}
          </p>
        ))}
      </div>
    </div>
  );
}

function PostsView({ text, onCopy }: { text: string; onCopy: (t: string) => void }) {
  const posts = text.split(/\n\s*---\s*\n|(?:^|\n)---(?:\n|$)/m).map((p) => p.trim()).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
      {posts.map((post, i) => (
        <div key={i} style={{ boxSizing: "border-box", padding: "18px 20px", borderRadius: 18, border: "1px solid rgba(255,255,255,0.34)", background: "rgba(255,255,255,0.14)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#ffffff" }}>Post {i + 1}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>{post.length} characters</span>
            <button
              onClick={() => onCopy(post)}
              style={{ marginLeft: "auto", height: 30, padding: "0 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)", color: "#ffffff", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              Copy
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.65, color: "rgba(255,255,255,0.95)", whiteSpace: "pre-wrap" }}>{post}</div>
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
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
        <div style={{ display: "flex", gap: 16, boxSizing: "border-box", padding: "16px 18px", borderRadius: 18, border: "1px solid rgba(255,255,255,0.34)", background: "rgba(255,255,255,0.14)" }}>
          <div style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.95)", whiteSpace: "pre-wrap" }}>{text}</div>
        </div>
      </div>
    );
  }

  const scenes: { time: string; title: string; text: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (!p) continue;
    if (labelRe.test(p)) {
      const inner = p.slice(1, -1);
      const spaceIdx = inner.lastIndexOf(" ");
      const time = spaceIdx >= 0 ? inner.slice(spaceIdx + 1) : "";
      const title = spaceIdx >= 0 ? inner.slice(0, spaceIdx) : inner;
      const nextText = i + 1 < parts.length && !labelRe.test(parts[i + 1].trim()) ? parts[i + 1].trim() : "";
      scenes.push({ time, title, text: nextText });
    }
  }

  if (scenes.length === 0) {
    return <div style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.95)", whiteSpace: "pre-wrap", marginTop: 20 }}>{text}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
      {scenes.map((v, i) => (
        <div key={i} style={{ display: "flex", gap: 16, boxSizing: "border-box", padding: "16px 18px", borderRadius: 18, border: "1px solid rgba(255,255,255,0.34)", background: "rgba(255,255,255,0.14)" }}>
          <div style={{ flexShrink: 0, width: 64 }}>
            <span style={{ height: 26, padding: "0 10px", borderRadius: 999, background: "rgba(255,255,255,0.24)", color: "#ffffff", fontSize: 12.5, fontWeight: 700, display: "inline-flex", alignItems: "center" }}>{v.time}</span>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#ffffff" }}>{v.title}</div>
            <div style={{ marginTop: 5, fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,255,255,0.95)" }}>{v.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Skeleton ---

function SkeletonOutput({ tab }: { tab: TabKey }) {
  const bone = (w: string | number, h = 14, mt = 0) => (
    <div className="tf-sk" style={{ width: w, height: h, borderRadius: h > 20 ? 10 : 7, background: "rgba(255,255,255,0.26)", marginTop: mt }} />
  );
  if (tab === "Article") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {bone(34, 34)}{bone(90, 16)}
        </div>
        {bone("84%", 26, 28)}{bone("52%", 26, 12)}
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
          {bone("100%", 14)}{bone("100%", 14)}{bone("92%", 14)}{bone("70%", 14)}
        </div>
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          {bone("100%", 14)}{bone("96%", 14)}{bone("100%", 14)}{bone("58%", 14)}
        </div>
      </div>
    );
  }
  if (tab === "Post") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ padding: "16px 18px", borderRadius: 18, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)" }}>
            {bone(80, 12)}
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {bone("100%", 12)}{bone("90%", 12)}{bone("80%", 12)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {bone(34, 34)}{bone(90, 16)}
      </div>
      {[0, 1, 2].map((j) => (
        <div key={j} style={{ marginTop: 28 }}>
          {bone(100, 22)}{bone("100%", 12, 10)}{bone("88%", 12, 8)}{bone("75%", 12, 8)}
        </div>
      ))}
    </div>
  );
}

// --- File helpers ---

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
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(10, 102, 194);
    for (const line of doc.splitTextToSize(headline, CW) as string[]) {
      ensureSpace(13); doc.text(line, ML, y); y += 13;
    }
    y += 1;
    doc.setDrawColor(10, 102, 194); doc.setLineWidth(0.6); doc.line(ML, y, ML + CW, y); y += 9;
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
    const bulletRe = /^[→•▪◦‣⁃●▸∙*]\s*/;
    const posts = content.split(/\n\s*---\s*\n|(?:^|\n)---(?:\n|$)/m).map((p) => p.trim()).filter(Boolean);
    for (let i = 0; i < posts.length; i++) {
      const rows: { text: string; x: number }[] = [];
      for (const raw of posts[i].split("\n")) {
        const t = raw.trim();
        const m = t.match(bulletRe);
        if (m) {
          const rest = t.slice(m[0].length).trim();
          const wrapped = doc.splitTextToSize(rest, CW - 18) as string[];
          rows.push({ text: "- " + wrapped[0], x: ML + 5 });
          for (let wi = 1; wi < wrapped.length; wi++) rows.push({ text: wrapped[wi], x: ML + 11 });
        } else if (t) {
          for (const wl of doc.splitTextToSize(t, CW - 10) as string[]) rows.push({ text: wl, x: ML + 5 });
        } else {
          rows.push({ text: "", x: ML + 5 });
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
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: headline, bold: true, color: "0A66C2" })], spacing: { after: 320 } }));
    for (const para of body.split(/\n\n+/).filter(Boolean)) {
      children.push(new Paragraph({ children: [new TextRun({ text: para.trim(), size: 24 })], spacing: { after: 160, line: 352 } }));
    }
  } else if (tab === "Post") {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Posts", bold: true, color: "0A66C2" })], spacing: { after: 400 } }));
    const posts = content.split(/\n\s*---\s*\n|(?:^|\n)---(?:\n|$)/m).map((p) => p.trim()).filter(Boolean);
    posts.forEach((post, i) => {
      children.push(new Paragraph({ children: [new TextRun({ text: `Post ${i + 1}`, bold: true, color: "0A66C2", size: 22 })], spacing: { before: i > 0 ? 500 : 0, after: 100 }, border: { left: { style: BorderStyle.THICK, size: 20, color: "0A66C2" } }, indent: { left: 280 } }));
      for (const line of post.split("\n")) {
        children.push(new Paragraph({ children: [new TextRun({ text: line || " ", size: 24 })], spacing: { after: 80, line: 330 }, border: { left: { style: BorderStyle.THICK, size: 20, color: "0A66C2" } }, indent: { left: 280 } }));
      }
    });
  } else {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Video Script", bold: true, color: "0A66C2" })], spacing: { after: 400 } }));
    const sectionRe = /(\[[A-Z][A-Z\s0-9]*\d+:\d+\])/g;
    const labelRe = /^\[[A-Z][A-Z\s0-9]*\d+:\d+\]$/;
    for (const part of content.split(sectionRe).filter((p) => p.trim())) {
      const clean = part.trim(); if (!clean) continue;
      if (labelRe.test(clean)) {
        children.push(new Paragraph({ children: [new TextRun({ text: clean.slice(1, -1), bold: true, color: "FFFFFF", size: 20 })], shading: { type: ShadingType.CLEAR, fill: "0A66C2", color: "auto" }, spacing: { before: 360, after: 140 } }));
      } else {
        for (const line of clean.split("\n").filter(Boolean)) {
          children.push(new Paragraph({ children: [new TextRun({ text: line, size: 24 })], spacing: { after: 100, line: 340 }, indent: { left: 360 } }));
        }
        children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
      }
    }
  }
  const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
  triggerDl(blob, filename);
}

// --- History types ---

interface HistoryEntry {
  id: string;
  format: TabKey;
  content: string;
  created_at: string;
}

function formatEntryDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: diffDays > 300 ? "numeric" : undefined });
}

// --- Saved contexts ---

interface SavedCtx { id: string; name: string; text: string; }

// --- Btn helper ---
const GlassBtn = ({ onClick, children, style }: { onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      height: 42, padding: "0 16px", borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)",
      color: "#ffffff", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
      display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
      ...style,
    }}
  >
    {children}
  </button>
);

// --- Main page ---

function TransformPage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const ws = state.workspace;

  const [context, setContext] = useState("");
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const pending = sessionStorage.getItem("pendingTranscript");
    if (pending) { setText(pending); sessionStorage.removeItem("pendingTranscript"); }
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
  const [savedCtxs, setSavedCtxs] = useState<SavedCtx[]>([]);
  const [showCtxMenu, setShowCtxMenu] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const userId = state.user?.id;
    if (!userId) return;
    supabase.from("saved_contexts").select("id, name, text").eq("user_id", userId).order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => { if (data) setSavedCtxs(data as SavedCtx[]); });
  }, [state.user?.id]);

  useEffect(() => { setHistoryEntries([]); }, [ws.companyId]);

  useEffect(() => {
    if (!showCtxMenu) return;
    const handler = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setShowCtxMenu(false); setShowSaveInput(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCtxMenu]);

  const fetchHistory = async () => {
    const companyId = ws.companyId;
    const userId = state.user?.id;
    if (!companyId || !userId) return;
    const { data, error } = await supabase.from("generations").select("id, format, content, created_at").eq("company_id", companyId).eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
    if (error) { console.error("History fetch error:", error); return; }
    setHistoryEntries((data as HistoryEntry[]) ?? []);
  };

  const saveCurrentCtx = async () => {
    const userId = state.user?.id;
    if (!saveName.trim() || !instructions.trim() || !userId) return;
    const { data, error } = await supabase.from("saved_contexts").insert({ user_id: userId, name: saveName.trim(), text: instructions.trim() }).select("id, name, text").single();
    if (error) { toast.error("Failed to save context."); return; }
    setSavedCtxs((prev) => [data as SavedCtx, ...prev]);
    setSaveName(""); setShowSaveInput(false); toast.success("Context saved.");
  };

  const deleteCtx = async (id: string) => {
    const { error } = await supabase.from("saved_contexts").delete().eq("id", id);
    if (error) { toast.error("Failed to delete context."); return; }
    setSavedCtxs((prev) => prev.filter(c => c.id !== id));
  };

  const hasAnyOutput = Object.keys(outputs).length > 0;
  const showOutput = hasAnyOutput || loading;

  const wsPayload = useMemo(() => ({
    companyName: ws.companyName, industry: ws.industry,
    goalDescription: ws.goalDescription, audience: ws.audience,
  }), [ws]);

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
    setLoading(false); setProgress(0);
  };

  const transform = async () => {
    if (!file && !text.trim()) { setError("Please upload a document or paste your content."); return; }
    setError(""); cancelledRef.current = false; setProgress(0); setLoading(true);
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
      clearInterval(progressTimerRef.current!); setProgress(100);
      const jk = JSON_KEY[tab];
      const generated = (data[jk as keyof typeof data] as string) ?? "";
      setOutputs((o) => ({ ...o, [tab]: generated }));
      const companyId = ws.companyId;
      const userId = state.user?.id;
      if (companyId && userId && generated.trim()) {
        await supabase.from("generations").insert({ company_id: companyId, user_id: userId, format: tab, content: generated });
        const { data: all } = await supabase.from("generations").select("id").eq("company_id", companyId).eq("user_id", userId).order("created_at", { ascending: false });
        if (all && all.length > 10) {
          await supabase.from("generations").delete().in("id", all.slice(10).map((r: any) => r.id));
        }
      }
    } catch (err: any) {
      if (!cancelledRef.current) setError(err.message ?? "Generation failed. Please try again.");
    } finally {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setLoading(false); setProgress(0);
    }
  };

  const regen = async (key: TabKey) => {
    if (!source) return;
    setTabBusy(key);
    try {
      const data = await callTransform({ format: key, regenerate: true, content: source.content, pdfBase64: source.pdfBase64, context: source.context, instructions, workspace: wsPayload });
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
      const data = await callTransform({ refine: true, format: key, existingContent: outputs[key], note, context, instructions, workspace: wsPayload });
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

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Copied to clipboard");
  };

  const loadFromHistory = (entry: HistoryEntry) => {
    setOutputs((o) => ({ ...o, [entry.format]: entry.content }));
    setTab(entry.format); setShowHistory(false);
    setTimeout(() => outputScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const userName = state.user?.name ?? "";
  const userInitials = userName.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "U";
  const companyInitial = (ws.companyName || "C")[0].toUpperCase();
  const activeTabBusy = tabBusy === tab;

  // Shared styles
  const inStyle: React.CSSProperties = {
    width: "100%", border: 0, borderRadius: 14, padding: "14px 16px",
    background: "rgba(255,255,255,0.18)", fontFamily: "inherit",
    fontSize: 15, lineHeight: 1.5, color: "#ffffff", resize: "none",
    boxSizing: "border-box",
  };
  const inStyleCompact: React.CSSProperties = {
    ...inStyle, fontSize: 14, padding: "11px 14px", borderRadius: 12,
  };
  const segBtnBase: React.CSSProperties = {
    flex: 1, border: 0, borderRadius: 11, cursor: "pointer",
    fontFamily: "inherit", fontWeight: 600, transition: "background .15s ease,color .15s ease",
  };

  return (
    <div className="sx-shell">

        {/* Left rail */}
        <aside className="sx-rail">
          <Link to="/welcome" className="sx-rail-logo" aria-label="SPECTR home" title="SPECTR home">
            <svg width="22" height="22" viewBox="0 0 24 24"><polygon points="12,3 21,21 12,21" fill="#0a66c2"/><polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55"/></svg></Link>
          <nav className="sx-rail-nav">
            {NAV_ITEMS.map((n) => (
              <button key={n.label} type="button" aria-label={n.label} title={n.label} onClick={() => navigate({ to: n.to as string })}
                style={{ width: 44, height: 44, borderRadius: "50%", border: 0, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", background: n.active ? "#0a66c2" : "transparent", color: n.active ? "#ffffff" : "rgba(255,255,255,0.9)", boxShadow: n.active ? "0 8px 20px rgba(6,42,92,0.35)" : "none" }}>
                <n.icon size={22} strokeWidth={1.8} aria-hidden="true" />
              </button>
            ))}
          </nav>
          <button type="button" className="sx-rail-out" aria-label="Log out" title="Log out" onClick={handleLogout}
            style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)", background: "transparent", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <LogOut size={20} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </aside>

        {/* Header */}
        <header className="sx-header">
          <div className="sx-header-title">
            <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: "-0.01em", lineHeight: 1.1 }}>Transform</div>
            <div className="sx-hide-sm" style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.9)" }}>Drop in a transcript, notes, or a document and get publish-ready content.</div>
          </div>
          <div className="sx-header-actions">
            <button type="button" onClick={() => { setShowHistory(true); fetchHistory(); }}
              style={{ height: 44, padding: "0 16px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)", color: "#ffffff", fontFamily: "inherit", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <History size={18} strokeWidth={1.9} aria-hidden="true" />
              History
            </button>
            <button type="button" style={{ height: 44, padding: "0 14px 0 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)", color: "#ffffff", fontFamily: "inherit", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#ffffff", color: "#0a66c2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{companyInitial}</span>
              <span className="sx-hide-sm">{ws.companyName || "Company"}</span>
              <ChevronsUpDown size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 5px 0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)" }}>
              <Bell size={20} strokeWidth={1.8} color="#ffffff" aria-hidden="true" />
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(145deg,#ffffff,#b9d6f8)", color: "#0a4a94", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, marginLeft: 6 }}>{userInitials}</div>
            </div>
          </div>
        </header>

        <main className="sx-main"><div className="sx-page">
        {/* ── FORM VIEW ── */}
        {!showOutput && (
          <div className="tf-form sx-glass">

            {/* Left column: options */}
            <div className="tf-form-left">
              {/* Output type */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Output type</div>
                <div style={{ marginTop: 10, display: "flex", padding: 4, borderRadius: 14, background: "rgba(255,255,255,0.18)", height: 52, boxSizing: "border-box", gap: 4 }}>
                  {TABS.map((t) => (
                    <button key={t.key} type="button" onClick={() => setTab(t.key)}
                      style={{ ...segBtnBase, fontSize: 15, background: tab === t.key ? "#0a66c2" : "transparent", color: tab === t.key ? "#ffffff" : "rgba(255,255,255,0.9)", boxShadow: tab === t.key ? "0 4px 12px rgba(10,102,194,0.3)" : "none" }}>
                      {t.designLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Context */}
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Add context</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>optional</span>
                </div>
                <textarea className="tf-in" placeholder="Who is this for, and what should it say?" value={context} onChange={(e) => setContext(e.target.value)}
                  style={{ ...inStyle, marginTop: 10, height: 112 }} />
              </div>

              {/* Instructions */}
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Content instructions</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>optional</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,0.85)" }}>
                  Control the shape and length of the output, for example 5 minutes long, 1500 words, 4 pillars, include a case study.
                </div>
                <textarea className="tf-in" placeholder="Add instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)}
                  style={{ ...inStyle, marginTop: 10, height: 112 }} />
                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }} ref={ctxMenuRef}>
                  <GlassBtn onClick={() => { if (instructions.trim()) setShowSaveInput(v => !v); else toast.error("Add instructions first."); }}>
                    <Save size={17} strokeWidth={1.9} aria-hidden="true" />
                    Save
                  </GlassBtn>
                  <div style={{ position: "relative" }}>
                    <GlassBtn onClick={() => setShowCtxMenu(v => !v)}>
                      <Upload size={17} strokeWidth={1.9} aria-hidden="true" />
                      Load saved
                      {savedCtxs.length > 0 && (
                        <span style={{ minWidth: 20, height: 20, padding: "0 6px", boxSizing: "border-box", borderRadius: 10, background: "#0a66c2", color: "#ffffff", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          {savedCtxs.length}
                        </span>
                      )}
                    </GlassBtn>
                    {showCtxMenu && (
                      <div style={{ position: "absolute", left: 0, top: "100%", marginTop: 6, width: 280, borderRadius: 14, zIndex: 50, overflow: "hidden", background: "rgba(26,86,168,0.95)", border: "1px solid rgba(255,255,255,0.4)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                        {savedCtxs.length === 0 ? (
                          <p style={{ fontSize: 13, padding: "16px", textAlign: "center", color: "rgba(255,255,255,0.7)" }}>No saved contexts yet.</p>
                        ) : savedCtxs.map(c => (
                          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
                            <button onClick={() => { setInstructions(c.text); setShowCtxMenu(false); toast.success(`Loaded "${c.name}"`); }}
                              style={{ flex: 1, textAlign: "left", fontSize: 13, fontWeight: 500, color: "#ffffff", background: "none", border: 0, cursor: "pointer", fontFamily: "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {c.name}
                            </button>
                            <button onClick={() => deleteCtx(c.id)} style={{ background: "none", border: 0, cursor: "pointer", color: "rgba(255,255,255,0.6)", flexShrink: 0 }}><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {showSaveInput && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                      <input autoFocus className="tf-in" placeholder="Name this context..."
                        value={saveName} onChange={e => setSaveName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveCurrentCtx()}
                        style={{ flex: 1, height: 42, padding: "0 12px", border: 0, borderRadius: 10, background: "rgba(255,255,255,0.18)", fontFamily: "inherit", fontSize: 13, color: "#ffffff", boxSizing: "border-box" }} />
                      <button onClick={saveCurrentCtx} style={{ height: 42, padding: "0 14px", borderRadius: 10, border: 0, background: "#ffffff", color: "#0a66c2", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
                      <button onClick={() => { setShowSaveInput(false); setSaveName(""); }} style={{ background: "none", border: 0, cursor: "pointer", color: "rgba(255,255,255,0.7)" }}><X size={16} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column: upload + paste + generate */}
            <div className="tf-form-right">
              <div style={{ fontSize: 14, fontWeight: 600 }}>Upload a document</div>
              <label style={{ marginTop: 10, display: "block", cursor: "pointer" }}>
                <div style={{ height: 148, boxSizing: "border-box", borderRadius: 18, border: "1.5px dashed rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.12)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, transition: "background .15s ease,border-color .15s ease" }}>
                  {!file ? (
                    <>
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: "#ffffff", boxShadow: "0 4px 12px rgba(6,42,92,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Upload size={22} strokeWidth={1.9} color="#0a66c2" aria-hidden="true" />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>Drop a file here, or <span style={{ textDecoration: "underline" }}>browse</span></div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>PDF, DOCX, or TXT</div>
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px", width: "100%", boxSizing: "border-box" }}>
                      <FileText size={18} color="#0a66c2" />
                      <span style={{ fontSize: 14, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                      <button onClick={(e) => { e.preventDefault(); setFile(null); }} style={{ background: "none", border: 0, cursor: "pointer", color: "rgba(255,255,255,0.7)", flexShrink: 0 }}><X size={16} /></button>
                    </div>
                  )}
                </div>
                <input type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>

              <div style={{ margin: "16px 0", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.4)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>or</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.4)" }} />
              </div>

              <div style={{ fontSize: 14, fontWeight: 600 }}>Paste your text</div>
              <textarea className="tf-in" placeholder="Paste your transcript, notes, or draft here..." value={text} onChange={(e) => setText(e.target.value)} disabled={!!file}
                style={{ ...inStyle, marginTop: 10, flex: 1, minHeight: 200, opacity: file ? 0.4 : 1 }} />

              {error && <div style={{ marginTop: 8, fontSize: 13, color: "#fca5a5" }}>{error}</div>}

              <button type="button" onClick={transform} disabled={loading}
                style={{ marginTop: 20, height: 54, borderRadius: 14, border: 0, background: "#ffffff", color: "#0a66c2", fontFamily: "inherit", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 10px 24px rgba(6,42,92,0.25)", opacity: loading ? 0.7 : 1, flexShrink: 0 }}>
                <Sparkles size={19} strokeWidth={1.9} aria-hidden="true" />
                {loading ? "Generating..." : `Generate ${tab === "Post" ? "Posts" : tab}`}
              </button>
            </div>
          </div>
        )}

        {/* ── RESULT VIEW ── */}
        {showOutput && (
          <div className="tf-result">
            {/* Left compact panel */}
            <div className="sx-glass" style={{ padding: 22, borderRadius: 28, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Type selector compact */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Output type</div>
                <div style={{ marginTop: 8, display: "flex", padding: 4, borderRadius: 14, background: "rgba(255,255,255,0.18)", height: 46, boxSizing: "border-box", gap: 4 }}>
                  {TABS.map((t) => (
                    <button key={t.key} type="button" onClick={() => setTab(t.key)}
                      style={{ ...segBtnBase, fontSize: 13.5, background: tab === t.key ? "#0a66c2" : "transparent", color: tab === t.key ? "#ffffff" : "rgba(255,255,255,0.9)", boxShadow: tab === t.key ? "0 4px 12px rgba(10,102,194,0.3)" : "none" }}>
                      {t.designLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Context compact */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Add context</div>
                <textarea className="tf-in" value={context} onChange={(e) => setContext(e.target.value)}
                  style={{ ...inStyleCompact, marginTop: 8, height: 64 }} />
              </div>

              {/* Instructions compact */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Content instructions</div>
                <textarea className="tf-in" value={instructions} onChange={(e) => setInstructions(e.target.value)}
                  style={{ ...inStyleCompact, marginTop: 8, height: 64 }} />
              </div>

              {/* Save/Load compact */}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => { if (instructions.trim()) setShowSaveInput(v => !v); else toast.error("Add instructions first."); }}
                  style={{ height: 38, padding: "0 14px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)", color: "#ffffff", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Save
                </button>
                <button type="button" onClick={() => setShowCtxMenu(v => !v)}
                  style={{ height: 38, padding: "0 14px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)", color: "#ffffff", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  Load saved
                  {savedCtxs.length > 0 && <span style={{ minWidth: 18, height: 18, padding: "0 5px", boxSizing: "border-box", borderRadius: 9, background: "#0a66c2", color: "#ffffff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{savedCtxs.length}</span>}
                </button>
              </div>

              {/* Upload compact */}
              <label style={{ cursor: "pointer" }}>
                <div style={{ height: 52, flexShrink: 0, boxSizing: "border-box", padding: "0 14px", borderRadius: 14, border: "1.5px dashed rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", gap: 12 }}>
                  <Upload size={20} strokeWidth={1.9} color="#ffffff" aria-hidden="true" />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{file ? file.name : "Upload a document"}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.85)" }}>PDF, DOCX, TXT</span>
                </div>
                <input type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>

              {/* Paste compact */}
              <textarea className="tf-in" placeholder="Paste your transcript, notes, or draft here..." value={text} onChange={(e) => setText(e.target.value)} disabled={!!file}
                style={{ ...inStyleCompact, flex: 1, minHeight: 120, opacity: file ? 0.4 : 1 }} />

              {/* Generate compact */}
              <button type="button" onClick={transform} disabled={loading}
                style={{ flexShrink: 0, height: 50, borderRadius: 14, border: 0, background: "#ffffff", color: "#0a66c2", fontFamily: "inherit", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 10px 24px rgba(6,42,92,0.25)", opacity: loading ? 0.7 : 1 }}>
                <Sparkles size={17} strokeWidth={1.9} aria-hidden="true" />
                {loading ? "Generating..." : `Generate ${tab === "Post" ? "Posts" : tab}`}
              </button>
            </div>

            {/* Right output panel */}
            <div className="sx-glass" style={{ borderRadius: 28, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              {/* Audience banner */}
              <div style={{ flexShrink: 0, boxSizing: "border-box", padding: "14px 28px", background: "rgba(255,255,255,0.14)", borderBottom: "1px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#ffffff" }}>
                <Target size={18} strokeWidth={1.9} color="#ffffff" aria-hidden="true" />
                <span><span style={{ fontWeight: 600 }}>Targeting:</span> {banner.replace("Targeting: ", "")}</span>
              </div>

              {/* Tab bar */}
              <div style={{ flexShrink: 0, display: "flex", gap: 28, padding: "0 28px", borderBottom: "1px solid rgba(255,255,255,0.3)" }}>
                {TABS.map((t) => (
                  <button key={t.key} type="button" onClick={() => setTab(t.key)}
                    style={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 600, padding: "16px 2px 14px", marginBottom: -1, borderBottom: `3px solid ${tab === t.key ? "#ffffff" : "transparent"}`, color: tab === t.key ? "#ffffff" : "rgba(255,255,255,0.78)", display: "flex", alignItems: "center", gap: 8 }}>
                    {t.designLabel}
                    {tabBusy === t.key && <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#ffffff", display: "inline-block", animation: "spin 0.7s linear infinite" }} />}
                  </button>
                ))}
              </div>

              {/* Scrollable output content */}
              <div ref={outputScrollRef} className="tf-scroll" style={{ flex: 1, minHeight: 0, boxSizing: "border-box", padding: "26px 28px 24px", overflowY: "auto", position: "relative" }}>
                {loading ? (
                  <SkeletonOutput tab={tab} />
                ) : outputs[tab] ? (() => {
                  const clean = safeExtract(outputs[tab]!, tab);
                  const tabLabel = tab === "Post" ? "Posts" : tab;
                  const tabIcon = tab === "Article"
                    ? <FileText size={18} strokeWidth={1.9} color="#ffffff" aria-hidden="true" />
                    : tab === "Post"
                    ? <MessageSquare size={18} strokeWidth={1.9} color="#ffffff" aria-hidden="true" />
                    : <Video size={18} strokeWidth={1.9} color="#ffffff" aria-hidden="true" />;

                  return (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>{tabIcon}</div>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>{tabLabel}</div>
                        {tab === "Post" && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{clean.split(/\n\s*---\s*\n|(?:^|\n)---(?:\n|$)/m).filter(p => p.trim()).length} drafts</span>}
                        {tab === "Video Script" && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>About 5 minutes</span>}
                        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {tab !== "Post" && (
                            <button type="button" onClick={() => copy(clean)}
                              style={{ height: 34, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)", color: "#ffffff", fontFamily: "inherit", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                              <Copy size={14} />Copy
                            </button>
                          )}
                          <button type="button" onClick={() => regen(tab)} disabled={activeTabBusy}
                            style={{ height: 34, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)", color: "#ffffff", fontFamily: "inherit", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", opacity: activeTabBusy ? 0.7 : 1 }}>
                            <RefreshCw size={14} className={activeTabBusy ? "animate-spin" : ""} />Regenerate
                          </button>
                          {tab === "Article" && (
                            <>
                              <button type="button" onClick={() => dlDocx(tab, clean, buildFilename(ws.companyName, userName, tab, "docx"))}
                                style={{ height: 34, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)", color: "#ffffff", fontFamily: "inherit", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                <Download size={14} />DOCX
                              </button>
                              <button type="button" onClick={() => dlPdf(tab, clean, buildFilename(ws.companyName, userName, tab, "pdf"))}
                                style={{ height: 34, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)", color: "#ffffff", fontFamily: "inherit", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                <Download size={14} />PDF
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {tab === "Article" && <ArticleView text={clean} />}
                      {tab === "Post" && <PostsView text={clean} onCopy={(t) => copy(t)} />}
                      {tab === "Video Script" && <VideoScriptView text={clean} />}
                    </>
                  );
                })() : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", gap: 12 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{tab === "Post" ? "Posts" : tab} not generated yet</div>
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.78)" }}>Select {tab === "Post" ? "Posts" : tab} on the left and click Generate.</div>
                  </div>
                )}
              </div>

              {/* Refine bar */}
              <div style={{ flexShrink: 0, boxSizing: "border-box", padding: "16px 28px", borderTop: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)", display: "flex", gap: 12, alignItems: "center" }}>
                <input className="tf-in" type="text" placeholder="Refine: make it shorter, add a stat, change the tone"
                  value={refineInput[tab] ?? ""} onChange={(e) => setRefineInput((r) => ({ ...r, [tab]: e.target.value }))}
                  style={{ flex: 1, height: 48, boxSizing: "border-box", padding: "0 16px", border: 0, borderRadius: 12, background: "rgba(255,255,255,0.18)", fontFamily: "inherit", fontSize: 15, color: "#ffffff" }}
                  onKeyDown={(e) => e.key === "Enter" && refine(tab)} />
                <button type="button" onClick={() => refine(tab)} disabled={activeTabBusy}
                  style={{ height: 48, padding: "0 24px", borderRadius: 12, border: 0, background: "#ffffff", color: "#0a66c2", fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: activeTabBusy ? 0.7 : 1 }}>
                  Refine
                </button>
              </div>
            </div>
          </div>
        )}
        </div></main>

        {/* ── GENERATING OVERLAY ── */}
        {loading && (
          <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, background: "rgba(10,50,110,0.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" as any, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 }}>
            <div role="dialog" aria-label="Generating content" style={{ width: 380, boxSizing: "border-box", padding: "36px 32px 28px", borderRadius: 28, background: "rgba(26,86,168,0.78)", border: "1px solid rgba(255,255,255,0.4)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" as any, color: "#ffffff", textAlign: "center", boxShadow: "0 30px 80px rgba(3,30,70,0.4)" }}>
              <div style={{ position: "relative", width: 132, height: 132, margin: "0 auto" }}>
                <svg width="132" height="132" viewBox="0 0 132 132" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="66" cy="66" r="56" fill="none" stroke="#e3ecf8" strokeWidth="9" />
                  <circle cx="66" cy="66" r="56" fill="none" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" strokeDasharray="351.86" strokeDashoffset={(351.86 * (1 - progress / 100)).toFixed(2) as any} style={{ transition: "stroke-dashoffset .2s linear" }} />
                </svg>
                <div style={{ position: "absolute", left: 0, top: 0, width: 132, height: 132, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 300, letterSpacing: "-0.02em" }}>{Math.round(progress)}%</div>
              </div>
              <div style={{ marginTop: 22, fontSize: 20, fontWeight: 600 }}>Generating content...</div>
              <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.85)" }}>This usually takes under a minute.</div>
              <button type="button" onClick={cancelTransform}
                style={{ marginTop: 24, height: 46, padding: "0 28px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)", color: "#ffffff", fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── HISTORY PANEL ── */}
        {showHistory && (
          <>
            <div onClick={() => setShowHistory(false)} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, background: "rgba(10,50,110,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" as any, zIndex: 30 }} />
            <aside role="dialog" aria-label="Generation history" className="tf-history" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 440, boxSizing: "border-box", background: "rgba(26,86,168,0.82)", borderLeft: "1px solid rgba(255,255,255,0.4)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" as any, color: "#ffffff", display: "flex", flexDirection: "column", boxShadow: "-20px 0 60px rgba(3,30,70,0.3)", zIndex: 31 }}>
              <div style={{ flexShrink: 0, boxSizing: "border-box", padding: "28px 28px 20px", display: "flex", alignItems: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>Generation history</div>
                <button type="button" aria-label="Close" onClick={() => setShowHistory(false)}
                  style={{ marginLeft: "auto", width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, boxSizing: "border-box", padding: "0 20px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
                {historyEntries.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "rgba(255,255,255,0.7)" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#ffffff", marginBottom: 6 }}>No history yet</div>
                    <div style={{ fontSize: 13 }}>Generated content will appear here.</div>
                  </div>
                ) : historyEntries.map((entry) => {
                  const raw = safeExtract(entry.content, entry.format);
                  const preview = raw.replace(/\n+/g, " ").trim().slice(0, 120);
                  const kindColor = entry.format === "Article" ? "rgba(255,255,255,0.24)" : entry.format === "Post" ? "#ecfdf3" : "#fffaeb";
                  const kindTextColor = entry.format === "Article" ? "#ffffff" : entry.format === "Post" ? "#067647" : "#b54708";
                  return (
                    <button key={entry.id} type="button" onClick={() => loadFromHistory(entry)}
                      style={{ boxSizing: "border-box", padding: "16px 18px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.34)", background: "rgba(255,255,255,0.12)", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "#ffffff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ height: 24, padding: "0 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", background: kindColor, color: kindTextColor }}>
                          {entry.format === "Post" ? "Posts" : entry.format}
                        </span>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{formatEntryDate(entry.created_at)}</span>
                      </div>
                      <div style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.55, color: "rgba(255,255,255,0.95)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
                        {preview}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ flexShrink: 0, boxSizing: "border-box", padding: "18px 28px", borderTop: "1px solid rgba(255,255,255,0.3)", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                Last 10 generations for this company
              </div>
            </aside>
          </>
        )}

    </div>
  );
}
