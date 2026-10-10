import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, FileText, Upload, X } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import { SpectrLogo } from "@/components/spectr/Logo";
import { LinkedInUploadSlots } from "@/components/spectr/LinkedInUpload";
import supabase from "@/lib/supabase";

export const Route = createFileRoute("/setup")({ component: SetupPage });

const COMPANY_SIZES = ["Startup", "SMB", "Mid-Market", "Enterprise", "All Sizes"];
const SENIORITY_LEVELS = ["Individual Contributor", "Technical / IC (Developers, Engineers)", "Manager", "Senior Manager / Director", "VP / SVP / EVP", "C-Suite", "Owner / Founder", "All Levels"];

const INDUSTRIES: Record<string, string[]> = {
  Technology: ["Software & SaaS", "Cybersecurity", "Artificial Intelligence", "Hardware & Semiconductors", "Telecommunications"],
  Finance: ["Banking & Financial Services", "Investment & Private Equity", "Insurance", "Accounting & Consulting", "Fintech"],
  "Healthcare & Life Sciences": ["Healthcare", "Pharmaceuticals", "Biotechnology", "Medical Devices", "Mental Health & Wellness"],
  "Professional Services": ["Legal", "Management Consulting", "Marketing & Advertising", "Recruiting & HR", "Public Relations"],
  "Industry & Manufacturing": ["Manufacturing", "Construction & Engineering", "Aerospace & Defense", "Automotive", "Logistics & Supply Chain"],
  "Consumer & Retail": ["Retail & E-commerce", "Food & Beverage", "Consumer Goods", "Hospitality & Tourism", "Real Estate"],
  "Education & Nonprofit": ["Education & EdTech", "Nonprofit & Social Impact", "Government & Public Sector", "Media & Publishing", "Research & Academia"],
};

function SetupPage() {
  const { state, update, setWorkspace } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(state.setupStep || 1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state.authLoading) return;
    if (!state.isAuthenticated) navigate({ to: "/login" });
    else if (state.setupComplete) navigate({ to: "/transform" });
  }, [state.authLoading, state.isAuthenticated, state.setupComplete, navigate]);

  useEffect(() => { update({ setupStep: step }); /* eslint-disable-next-line */ }, [step]);

  const ws = state.workspace;
  const skipBaseline = ws.startingFromScratch;
  const totalSteps = skipBaseline ? 3 : 4;
  // Visible step index mapping
  const visibleStep = step === 1 ? 1 : skipBaseline ? step - 1 : step;

  const next = () => {
    let n = step + 1;
    if (n === 2 && skipBaseline) n = 3;
    setStep(n);
  };
  const back = () => {
    let n = step - 1;
    if (n === 2 && skipBaseline) n = 1;
    if (n < 1) n = 1;
    setStep(n);
  };

  const finish = async () => {
    setSaving(true);

    let companyId = ws.companyId;

    // If user reached setup without going through /companies, create the company now
    if (!companyId && ws.companyName.trim() && state.user?.id) {
      await supabase.from("profiles").upsert(
        { id: state.user.id, full_name: state.user.name, email: state.user.email },
        { onConflict: "id" },
      );
      const { data } = await supabase
        .from("companies")
        .insert([{ name: ws.companyName.trim(), created_by: state.user.id }])
        .select()
        .limit(1)
        .single();
      if (data) {
        companyId = data.id;
        setWorkspace({ companyId: data.id });
      }
    }

    if (state.user?.id && companyId) {
      await supabase.from("workspaces").upsert(
        {
          company_id: companyId,
          user_id: state.user.id,
          industry: ws.industry,
          primary_platform: ws.primaryPlatform,
          starting_from_scratch: ws.startingFromScratch,
          baseline: ws.baseline,
          targets: ws.targets,
          goal_description: ws.goalDescription,
          audience: ws.audience,
          setup_complete: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,user_id" }
      );
      // Best-effort: save new fields once the columns exist in the DB
      supabase.from("workspaces").update({
        company_description: ws.companyDescription,
        company_pdf_url: ws.companyPdfUrl || null,
      }).eq("company_id", companyId).eq("user_id", state.user.id).then(() => {});
    }

    update({ setupComplete: true });
    navigate({ to: "/transform" });
  };

  if (!state.isAuthenticated) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[600px] mb-4">
        <Link to="/companies" className="inline-flex items-center gap-1 text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: "var(--color-text-secondary)" }}>
          <ChevronLeft size={16} /> Companies
        </Link>
      </div>
      <div className="mb-6"><SpectrLogo size={36} /></div>

      {step <= 4 && (
        <Stepper current={visibleStep} total={totalSteps} />
      )}

      <div className="w-full max-w-[600px] spectr-card p-8 mt-6 spectr-step-enter" key={step}>
        {step === 1 && <Step1 ws={ws} setWorkspace={setWorkspace} onNext={next} userId={state.user?.id} />}
        {step === 2 && !skipBaseline && <Step2 ws={ws} setWorkspace={setWorkspace} onNext={next} onBack={back} />}
        {step === 3 && <Step3 ws={ws} setWorkspace={setWorkspace} onNext={next} onBack={back} />}
        {step === 4 && <Step4 ws={ws} setWorkspace={setWorkspace} onNext={() => setStep(5)} onBack={back} />}
        {step === 5 && <Complete ws={ws} onLaunch={finish} saving={saving} />}
      </div>
    </div>
  );
}

function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className="flex items-center justify-center rounded-full text-xs font-semibold"
              style={{
                width: 28, height: 28,
                background: done || active ? "var(--color-primary)" : "var(--color-card-2)",
                color: done || active ? "white" : "var(--color-text-secondary)",
                border: `1px solid ${done || active ? "var(--color-primary)" : "var(--color-border)"}`,
                boxShadow: done || active ? "var(--glow-primary-sm)" : "none",
              }}>
              {done ? <Check size={14} /> : n}
            </div>
            {n < total && <div style={{ width: 32, height: 2, background: done ? "var(--color-primary)" : "var(--color-border)", boxShadow: done ? "var(--glow-primary-sm)" : "none" }} />}
          </div>
        );
      })}
    </div>
  );
}

function H({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-6">
      <h2 className="spectr-display" style={{ fontSize: 24 }}>{title}</h2>
      <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>{sub}</p>
    </div>
  );
}

function Nav({ onBack, onNext, nextLabel = "Continue", disabled, onSkip }:
  { onBack?: () => void; onNext: () => void; nextLabel?: string; disabled?: boolean; onSkip?: () => void }) {
  return (
    <div className="mt-8 flex items-center justify-between">
      {onBack ? (
        <button onClick={onBack} className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>Back</button>
      ) : <span />}
      <div className="flex items-center gap-4">
        {onSkip && <button onClick={onSkip} className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>Skip for now</button>}
        <button onClick={onNext} disabled={disabled} className="spectr-btn-primary">{nextLabel}</button>
      </div>
    </div>
  );
}

function Step1({ ws, setWorkspace, onNext, userId }: any) {
  const can = ws.companyName.trim() && ws.industry.trim() && (ws.companyDescription.trim() || ws.companyPdfUrl);
  return (
    <>
      <H title="Let's set up your workspace" sub="SPECTR will use this to calibrate every piece of content it generates." />
      <div className="space-y-4">
        <div><label className="spectr-label">Company Name</label>
          <input className="spectr-input" placeholder="" value={ws.companyName} onChange={(e) => setWorkspace({ companyName: e.target.value })} /></div>
        <div><label className="spectr-label">Industry / Sector</label>
          <IndustrySelector value={ws.industry} onChange={(v) => setWorkspace({ industry: v })} /></div>
        <CompanyBrief ws={ws} setWorkspace={setWorkspace} userId={userId} />
        <div>
          <label className="spectr-label">Primary Platform</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { name: "LinkedIn", enabled: true },
              { name: "Instagram", enabled: false },
              { name: "TikTok", enabled: false },
              { name: "YouTube", enabled: false },
            ].map((p) => (
              <div key={p.name} className="rounded-md p-3 text-center text-xs font-semibold relative"
                style={{
                  border: `2px solid ${p.enabled ? "var(--color-primary)" : "var(--color-border)"}`,
                  background: p.enabled ? "rgba(10,102,194,0.06)" : "var(--color-surface)",
                  color: p.enabled ? "var(--color-primary)" : "var(--color-text-secondary)",
                  opacity: p.enabled ? 1 : 0.6,
                }}>
                {p.name}
                {!p.enabled && <div className="text-[9px] mt-1">Coming Soon</div>}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setWorkspace({ startingFromScratch: !ws.startingFromScratch })}
          className="flex items-center justify-between w-full p-3 rounded-md transition-colors"
          style={{
            background: ws.startingFromScratch ? "rgba(10,102,194,0.08)" : "var(--color-surface)",
            border: `1.5px solid ${ws.startingFromScratch ? "var(--color-primary)" : "var(--color-border)"}`,
          }}
        >
          <span className="text-sm font-medium" style={{ color: ws.startingFromScratch ? "var(--color-primary)" : "inherit" }}>
            Are you starting from scratch?
          </span>
          <div
            className="flex items-center justify-center rounded-full transition-colors"
            style={{
              width: 24, height: 24,
              background: ws.startingFromScratch ? "var(--color-primary)" : "transparent",
              border: `2px solid ${ws.startingFromScratch ? "var(--color-primary)" : "var(--color-border)"}`,
            }}
          >
            {ws.startingFromScratch && <Check size={13} color="white" strokeWidth={3} />}
          </div>
        </button>
      </div>
      <Nav onNext={onNext} disabled={!can} />
    </>
  );
}

const KEYWORD_CATEGORIES: { keywords: string[]; fields: string[] }[] = [
  {
    keywords: ["grow", "followers", "audience", "reach", "awareness", "brand", "visibility"],
    fields: ["followers", "followerGrowth", "weeklyImpressions"],
  },
  {
    keywords: ["engagement", "content", "posts", "comments", "likes", "shares", "interact", "community"],
    fields: ["engagementRate", "weeklyImpressions"],
  },
  {
    keywords: ["leads", "traffic", "visitors", "pipeline", "clients", "sales", "conversions", "drive", "website"],
    fields: ["monthlyVisitors", "engagementRate"],
  },
  {
    keywords: ["search", "searchability", "discoverability", "surfaces", "appear", "found"],
    fields: ["weeklyPageSearches"],
  },
];

function getRequiredTargets(goal: string): Set<string> {
  const lower = goal.toLowerCase();
  const required = new Set<string>();
  for (const cat of KEYWORD_CATEGORIES) {
    if (cat.keywords.some((kw) => lower.includes(kw))) {
      cat.fields.forEach((f) => required.add(f));
    }
  }
  return required;
}

function NumGrid({ ws, setWorkspace, kind, requiredTargets }: { ws: any; setWorkspace: any; kind: "baseline" | "targets"; requiredTargets?: Set<string> }) {
  const fields = [
    { key: "followers", label: kind === "baseline" ? "Current Followers" : "Followers Target", hint: "Total followers on your company page", required: kind === "baseline" },
    { key: "followerGrowth", label: kind === "baseline" ? "Avg Weekly Follower Growth" : "Weekly Follower Growth Target", hint: kind === "baseline" ? "Auto-filled from your Followers export. Average new followers gained per week." : "Target average new followers per week" },
    {
      key: "weeklyImpressions",
      label: kind === "baseline" ? "Avg Weekly Impressions" : "Weekly Impressions Target",
      hint: kind === "baseline"
        ? "Company page → Analytics → Content. Pick a date range, take the total impressions, and divide by the number of weeks."
        : "Average impressions across all posts per week",
      optional: kind === "baseline",
    },
    { key: "engagementRate", label: kind === "baseline" ? "Avg Engagement Rate (%)" : "Engagement Rate Target (%)", hint: "Likes + comments + shares / impressions" },
    { key: "monthlyVisitors", label: kind === "baseline" ? "Monthly Profile Visitors" : "Monthly Visitors Target", hint: "Unique visitors to your company page" },
  ];

  function fieldBadge(key: string, baseOptional?: boolean) {
    if (kind === "targets" && requiredTargets) {
      if (requiredTargets.has(key)) {
        return <span style={{ color: "var(--color-destructive)" }}>*</span>;
      }
      return (
        <span className="text-[11px] font-medium px-1.5 py-px rounded"
          style={{ background: "rgba(10,102,194,0.08)", color: "var(--color-primary)" }}>
          Optional
        </span>
      );
    }
    if (baseOptional) {
      return (
        <span className="text-[11px] font-medium px-1.5 py-px rounded"
          style={{ background: "rgba(10,102,194,0.08)", color: "var(--color-primary)" }}>
          Optional
        </span>
      );
    }
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="spectr-label flex items-center gap-2">
            <span className="flex items-center gap-1">
              {f.label}
              {f.required && <span style={{ color: "var(--color-destructive)" }}>*</span>}
            </span>
            {!f.required && fieldBadge(f.key, f.optional)}
          </label>
          <input type="number" className="spectr-input" value={ws[kind][f.key]} onChange={(e) => setWorkspace({ [kind]: { ...ws[kind], [f.key]: e.target.value } })} />
          <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>{f.hint}</p>
        </div>
      ))}
      <div className="col-span-2">
        <label className="spectr-label flex items-center gap-2">
          {kind === "baseline" ? "Weekly Page Searches" : "Weekly Page Searches Target"}
          {kind === "baseline" ? (
            <span className="text-[11px] font-medium px-1.5 py-px rounded"
              style={{ background: "rgba(10,102,194,0.08)", color: "var(--color-primary)" }}>
              Optional
            </span>
          ) : fieldBadge("weeklyPageSearches")}
        </label>
        <input type="number" className="spectr-input" value={ws[kind].weeklyPageSearches} onChange={(e) => setWorkspace({ [kind]: { ...ws[kind], weeklyPageSearches: e.target.value } })} />
        <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
          {kind === "baseline"
            ? "Company page → Analytics → Overview → Search Appearances."
            : "How many times your page surfaces in LinkedIn search per week"}
        </p>
      </div>
    </div>
  );
}

function Step2({ ws, setWorkspace, onNext, onBack }: any) {
  return (
    <>
      <H title="Where are you starting from?" sub="Upload your LinkedIn analytics exports to auto-fill, or enter numbers manually." />
      <LinkedInUploadSlots ws={ws} setWorkspace={setWorkspace} />
      <NumGrid ws={ws} setWorkspace={setWorkspace} kind="baseline" />
      <Nav onBack={onBack} onNext={onNext} onSkip={onNext} />
    </>
  );
}

function Step3({ ws, setWorkspace, onNext, onBack }: any) {
  const can = ws.goalDescription.trim();
  const requiredTargets = getRequiredTargets(ws.goalDescription);
  return (
    <>
      <H title="What does success look like?" sub="Set your 12-week targets. SPECTR will track your progress against these." />
      <div className="space-y-4">
        <div>
          <label className="spectr-label flex items-center gap-1">
            Goal Description
            <span style={{ color: "var(--color-destructive)" }}>*</span>
          </label>
          <textarea className="spectr-textarea" rows={3} placeholder=""
            value={ws.goalDescription} onChange={(e) => setWorkspace({ goalDescription: e.target.value })} />
          <p className="text-xs mt-2 px-3 py-2 rounded-md" style={{ background: "rgba(10,102,194,0.06)", color: "var(--color-text-secondary)", border: "1px solid rgba(10,102,194,0.15)" }}>
            Your goal determines which targets are required. Be as specific as possible about what you want to achieve on LinkedIn.
          </p>
        </div>
        <h3 className="text-sm font-bold mt-4">12-Week Targets</h3>
        <NumGrid ws={ws} setWorkspace={setWorkspace} kind="targets" requiredTargets={requiredTargets} />
      </div>
      <Nav onBack={onBack} onNext={onNext} disabled={!can} onSkip={onNext} />
    </>
  );
}

function Step4({ ws, setWorkspace, onNext, onBack }: any) {
  return (
    <>
      <H title="Who are you trying to reach?" sub="SPECTR uses this to calibrate every content output to your exact audience." />
      <div className="space-y-4">
        <div><label className="spectr-label">Job Titles</label>
          <input className="spectr-input" placeholder=""
            value={ws.audience.jobTitles} onChange={(e) => setWorkspace({ audience: { ...ws.audience, jobTitles: e.target.value } })} /></div>
        <div><label className="spectr-label">Seniority Level</label>
          <select className="spectr-input" value={ws.audience.seniority}
            onChange={(e) => setWorkspace({ audience: { ...ws.audience, seniority: e.target.value } })}>
            <option value="">Select level...</option>
            {SENIORITY_LEVELS.map((s) => <option key={s}>{s}</option>)}
          </select></div>
        <div><label className="spectr-label">Company Size</label>
          <select className="spectr-input" value={ws.audience.companySize}
            onChange={(e) => setWorkspace({ audience: { ...ws.audience, companySize: e.target.value } })}>
            <option value="">Select size...</option>
            {COMPANY_SIZES.map((s) => <option key={s}>{s}</option>)}
          </select></div>
        <div>
          <label className="spectr-label flex items-center gap-2">
            Audience Description
            <span className="text-[11px] font-medium px-1.5 py-px rounded"
              style={{ background: "rgba(10,102,194,0.08)", color: "var(--color-primary)" }}>
              Optional
            </span>
          </label>
          <textarea className="spectr-textarea" rows={3} placeholder=""
            value={ws.audience.description} onChange={(e) => setWorkspace({ audience: { ...ws.audience, description: e.target.value } })} />
        </div>
      </div>
      <Nav onBack={onBack} onNext={onNext} nextLabel="Review" />
    </>
  );
}

function CompanyBrief({ ws, setWorkspace, userId }: any) {
  const [mode, setMode] = useState<"text" | "pdf">(ws.companyPdfUrl ? "pdf" : "text");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const switchMode = (m: "text" | "pdf") => {
    setMode(m);
    setUploadError("");
    if (m === "text") {
      setWorkspace({ companyPdfUrl: "", companyPdfName: "" });
    } else {
      setWorkspace({ companyDescription: "" });
    }
  };

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") { setUploadError("Please upload a PDF file."); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError("File must be under 10 MB."); return; }
    setUploadError("");
    setUploading(true);
    const path = `${userId}/company-brief-${Date.now()}.pdf`;
    const { error } = await supabase.storage.from("company-docs").upload(path, file, { upsert: true });
    if (error) { setUploadError(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("company-docs").getPublicUrl(path);
    setWorkspace({ companyPdfUrl: data.publicUrl, companyPdfName: file.name });
    setUploading(false);
  };

  const clearPdf = () => {
    setWorkspace({ companyPdfUrl: "", companyPdfName: "" });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <label className="spectr-label">Company / Product Brief</label>
      <p className="text-xs mb-2" style={{ color: "var(--color-text-secondary)" }}>
        SPECTR reads this to understand what you do and generate on-brand content.
      </p>

      {/* Mode toggle */}
      <div className="flex rounded-md overflow-hidden mb-3" style={{ border: "1.5px solid var(--color-border)" }}>
        {(["text", "pdf"] as const).map((m) => (
          <button key={m} type="button" onClick={() => switchMode(m)}
            className="flex-1 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: mode === m ? "var(--color-primary)" : "var(--color-card-2)",
              color: mode === m ? "white" : "var(--color-text-secondary)",
              boxShadow: mode === m ? "var(--glow-primary-sm)" : "none",
            }}>
            {m === "text" ? "Write description" : "Upload PDF"}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <textarea
          className="spectr-textarea"
          rows={4}
          placeholder=""
          value={ws.companyDescription}
          onChange={(e) => setWorkspace({ companyDescription: e.target.value })}
        />
      ) : (
        <div>
          {ws.companyPdfUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-md" style={{ background: "rgba(10,102,194,0.06)", border: "1.5px solid var(--color-primary)" }}>
              <FileText size={18} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
              <span className="text-sm font-medium flex-1 truncate" style={{ color: "var(--color-primary)" }}>{ws.companyPdfName}</span>
              <button type="button" onClick={clearPdf} className="p-0.5 rounded hover:opacity-70 transition-opacity" style={{ color: "var(--color-primary)" }}>
                <X size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full flex flex-col items-center gap-2 py-6 rounded-md transition-colors"
              style={{ border: "2px dashed var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)" }}
            >
              <Upload size={20} />
              <span className="text-sm font-medium">{uploading ? "Uploading…" : "Click to upload PDF"}</span>
              <span className="text-xs">Max 10 MB</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {uploadError && <p className="text-xs mt-1.5" style={{ color: "#dc2626" }}>{uploadError}</p>}
        </div>
      )}
    </div>
  );
}

function IndustrySelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function derive(v: string) {
    if (!v) return { sector: "", sub: "", custom: "" };
    for (const [s, subs] of Object.entries(INDUSTRIES)) {
      if (v === s) return { sector: s, sub: "", custom: "" };
      if (subs.includes(v)) return { sector: s, sub: v, custom: "" };
    }
    return { sector: "Other", sub: "", custom: v };
  }

  const init = derive(value);
  const [sector, setSector] = useState(init.sector);
  const [sub, setSub] = useState(init.sub);
  const [custom, setCustom] = useState(init.custom);

  const handleSector = (s: string) => {
    setSector(s);
    setSub("");
    setCustom("");
    onChange(s === "Other" ? "" : s);
  };

  const handleSub = (s: string) => {
    setSub(s);
    setCustom("");
    onChange(s === "Other" ? "" : s);
  };

  const handleCustom = (v: string) => {
    setCustom(v);
    onChange(v);
  };

  const showSub = sector !== "" && sector !== "Other";
  const showCustom = sector === "Other" || sub === "Other";

  return (
    <div className="space-y-2">
      <select className="spectr-input" value={sector} onChange={(e) => handleSector(e.target.value)}>
        <option value="">Select sector…</option>
        {Object.keys(INDUSTRIES).map((s) => <option key={s} value={s}>{s}</option>)}
        <option value="Other">Other</option>
      </select>

      {showSub && (
        <select className="spectr-input" value={sub} onChange={(e) => handleSub(e.target.value)}>
          <option value="">Select industry…</option>
          {INDUSTRIES[sector].map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="Other">Other</option>
        </select>
      )}

      {showCustom && (
        <input
          className="spectr-input"
          placeholder="Type your industry / sector…"
          value={custom}
          onChange={(e) => handleCustom(e.target.value)}
          autoFocus
        />
      )}
    </div>
  );
}

function Complete({ ws, onLaunch, saving }: { ws: any; onLaunch: () => void; saving?: boolean }) {
  const rows: [string, string, boolean?][] = [
    ["Company", ws.companyName],
    ["Industry", ws.industry],
    ["Primary Platform", ws.primaryPlatform],
    ["Job Titles", ws.audience.jobTitles || "—"],
    ["Seniority", ws.audience.seniority || "—"],
    ["Company Size", ws.audience.companySize || "—"],
  ];
  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <div className="rounded-full flex items-center justify-center mb-4"
          style={{ background: "var(--color-primary)", width: 64, height: 64, boxShadow: "var(--glow-primary-lg)" }}>
          <Check size={36} color="white" />
        </div>
        <h2 className="spectr-display" style={{ fontSize: 24 }}>You're all set</h2>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>Review your workspace and launch SPECTR.</p>
      </div>
      <div className="mt-6 p-4 rounded-md space-y-3" style={{ background: "var(--color-surface)" }}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {rows.map(([k, v]) => (
            <div key={k}>
              <div className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>{k}</div>
              <div className="text-sm mt-0.5 truncate">{v}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Goal</div>
          <div className="text-sm mt-0.5 leading-relaxed">{ws.goalDescription || "—"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Company Brief</div>
          {ws.companyPdfUrl ? (
            <div className="flex items-center gap-2 mt-0.5">
              <FileText size={14} style={{ color: "var(--color-primary)" }} />
              <span className="text-sm truncate">{ws.companyPdfName || "Uploaded PDF"}</span>
            </div>
          ) : (
            <div className="text-sm mt-0.5 leading-relaxed line-clamp-3">{ws.companyDescription || "—"}</div>
          )}
        </div>
      </div>
      <button onClick={onLaunch} disabled={saving} className="spectr-btn-primary w-full mt-6">
        {saving ? "Saving…" : "Launch SPECTR"}
      </button>
    </div>
  );
}
