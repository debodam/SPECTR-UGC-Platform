import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
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

const KEYWORD_CATEGORIES: { keywords: string[]; fields: string[] }[] = [
  { keywords: ["grow", "followers", "audience", "reach", "awareness", "brand", "visibility"], fields: ["followers", "followerGrowth", "weeklyImpressions"] },
  { keywords: ["engagement", "content", "posts", "comments", "likes", "shares", "interact", "community"], fields: ["engagementRate", "weeklyImpressions"] },
  { keywords: ["leads", "traffic", "visitors", "pipeline", "clients", "sales", "conversions", "drive", "website"], fields: ["monthlyVisitors", "engagementRate"] },
  { keywords: ["search", "searchability", "discoverability", "surfaces", "appear", "found"], fields: ["weeklyPageSearches"] },
];

function getRequiredTargets(goal: string): Set<string> {
  const lower = goal.toLowerCase();
  const required = new Set<string>();
  for (const cat of KEYWORD_CATEGORIES) {
    if (cat.keywords.some((kw) => lower.includes(kw))) cat.fields.forEach((f) => required.add(f));
  }
  return required;
}

function SpectrMark() {
  return (
    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24">
        <polygon points="12,3 21,21 12,21" fill="#0a66c2" />
        <polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55" />
      </svg>
    </div>
  );
}

const RAIL_ITEMS = [
  { n: 1, title: "Company", sub: "About your business" },
  { n: 2, title: "Goals", sub: "12-week targets" },
  { n: 3, title: "Audience", sub: "Who you reach" },
  { n: 4, title: "Review", sub: "Check and launch" },
];

const STEP_TITLES: Record<number, string> = {
  1: "Let's set up your workspace",
  2: "Where are you starting from?",
  3: "What does success look like?",
  4: "Who are you trying to reach?",
  5: "You're all set",
};
const STEP_SUBS: Record<number, string> = {
  1: "SPECTR will use this to calibrate every piece of content it generates.",
  2: "Upload your LinkedIn analytics exports to auto-fill, or enter numbers manually.",
  3: "Set your 12-week targets. SPECTR will track your progress against these.",
  4: "SPECTR uses this to calibrate every content output to your exact audience.",
  5: "Review your workspace and launch SPECTR.",
};

function SetupPage() {
  const { state, update, setWorkspace } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(state.setupStep || 1);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (state.authLoading) return;
    if (!state.isAuthenticated) navigate({ to: "/login" });
    else if (state.setupComplete) navigate({ to: "/transform" });
  }, [state.authLoading, state.isAuthenticated, state.setupComplete, navigate]);

  useEffect(() => { update({ setupStep: step }); /* eslint-disable-next-line */ }, [step]);

  const ws = state.workspace;
  const skipBaseline = ws.startingFromScratch;

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
    if (!companyId && ws.companyName.trim() && state.user?.id) {
      await supabase.from("profiles").upsert(
        { id: state.user.id, full_name: state.user.name, email: state.user.email },
        { onConflict: "id" },
      );
      const { data } = await supabase.from("companies")
        .insert([{ name: ws.companyName.trim(), created_by: state.user.id }])
        .select().limit(1).single();
      if (data) { companyId = data.id; setWorkspace({ companyId: data.id }); }
    }
    if (state.user?.id && companyId) {
      await supabase.from("workspaces").upsert(
        { company_id: companyId, user_id: state.user.id, industry: ws.industry, primary_platform: ws.primaryPlatform, starting_from_scratch: ws.startingFromScratch, baseline: ws.baseline, targets: ws.targets, goal_description: ws.goalDescription, audience: ws.audience, setup_complete: true, updated_at: new Date().toISOString() },
        { onConflict: "company_id,user_id" },
      );
      supabase.from("workspaces").update({ company_description: ws.companyDescription, company_pdf_url: ws.companyPdfUrl || null })
        .eq("company_id", companyId).eq("user_id", state.user.id).then(() => {});
    }
    update({ setupComplete: true });
    navigate({ to: "/transform" });
  };

  if (!state.isAuthenticated) return null;
  if (state.authLoading) return <div style={{ minHeight: "100vh" }} />;

  // Rail mapping: steps 1→rail1, 2-3→rail2, 4→rail3, 5→rail4
  const railNum = step === 1 ? 1 : step <= 3 ? 2 : step === 4 ? 3 : 4;
  const railDone = (n: number) => n === 1 ? step > 1 : n === 2 ? step > 3 : n === 3 ? step > 4 : false;
  const railCur = (n: number) => n === 1 ? step === 1 : n === 2 ? (step === 2 || step === 3) : n === 3 ? step === 4 : step === 5;

  const isLaunch = step === 5;
  const showBack = step > 1;
  const showSkip = step === 2 || step === 3;
  const canNext = step === 1
    ? !!(ws.companyName.trim() && ws.industry.trim() && (ws.companyDescription.trim() || ws.companyPdfUrl))
    : step === 3 ? !!ws.goalDescription.trim()
    : true;
  const nextLabel = isLaunch ? (saving ? "Launching" : "Launch SPECTR") : step === 4 ? "Review" : "Continue";

  const handleNext = () => {
    if (isLaunch) { finish(); return; }
    if (!canNext) { setShowErrors(true); return; }
    setShowErrors(false); next();
  };
  const handleBack = () => { setShowErrors(false); back(); };
  const handleSkip = () => { setShowErrors(false); next(); };

  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex", overflow: "hidden", color: "#ffffff",
      background: "linear-gradient(150deg,#5b9be4 0%,#3a82dc 42%,#1a56a8 100%)",
    }}>

        {/* Left sidebar */}
        <aside style={{ position: "relative", width: 340, flexShrink: 0, boxSizing: "border-box", padding: "40px 36px", background: "rgba(255,255,255,0.1)", borderRight: "1px solid rgba(255,255,255,0.28)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SpectrMark />
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.02em" }}>SPECTR</span>
          </div>

          <div style={{ marginTop: 56 }}>
            <div style={{ fontSize: 24, fontWeight: 300, letterSpacing: "-0.01em" }}>Workspace setup</div>
            <div style={{ marginTop: 14, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.28)", overflow: "hidden" }}>
              <div style={{ width: `${(railNum / 4) * 100}%`, height: "100%", borderRadius: 3, background: "#ffffff", transition: "width 0.3s ease" }} />
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.9)" }}>Step {railNum} of 4</div>
          </div>

          <div style={{ marginTop: 40 }}>
            {RAIL_ITEMS.map((r) => {
              const done = railDone(r.n);
              const cur = railCur(r.n);
              return (
                <div key={r.n} style={{ position: "relative", minHeight: 84 }}>
                  <div style={{
                    position: "absolute", left: 0, top: 0, width: 34, height: 34, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, boxSizing: "border-box",
                    ...(done ? { background: "#12b76a" } : cur ? { background: "#0a66c2", color: "#ffffff", boxShadow: "0 0 0 5px rgba(255,255,255,0.4)" } : { border: "1.5px solid rgba(255,255,255,0.6)", color: "rgba(255,255,255,0.78)" }),
                  }}>
                    {done ? (
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    ) : <span>{r.n}</span>}
                  </div>
                  {r.n !== 4 && (
                    <div style={{ position: "absolute", left: 16, top: 44, width: 2, height: 34, borderRadius: 1, background: done ? "#12b76a" : "rgba(255,255,255,0.35)" }} />
                  )}
                  <div style={{ paddingLeft: 50, paddingTop: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: cur ? 700 : 600, color: cur ? "#ffffff" : done ? "#e6f0ff" : "rgba(255,255,255,0.78)" }}>{r.title}</div>
                    <div style={{ marginTop: 2, fontSize: 13, color: "rgba(255,255,255,0.78)" }}>{r.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => navigate({ to: "/companies" })}
            style={{ position: "absolute", left: 36, bottom: 36, height: 40, padding: "0 16px 0 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", color: "#ffffff", fontSize: 14, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            Companies
          </button>
        </aside>

        {/* Right section */}
        <section style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden" }}>
          {/* Scrollable content */}
          <div className="spectr-scroll" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 88, overflowY: "auto", padding: "44px 48px 32px", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {step === 5 && (
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#12b76a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 10px 24px rgba(18,183,106,0.3)" }}>
                  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </div>
              )}
              <div>
                <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.15, fontWeight: 300, letterSpacing: "-0.02em" }}>{STEP_TITLES[step]}</h1>
                <p style={{ margin: "6px 0 0", fontSize: 16, color: "rgba(255,255,255,0.88)" }}>{STEP_SUBS[step]}</p>
              </div>
            </div>

            <div style={{ marginTop: 26 }}>
              {step === 1 && <StepCompany ws={ws} setWorkspace={setWorkspace} showErrors={showErrors} userId={state.user?.id} />}
              {step === 2 && !skipBaseline && <StepBaseline ws={ws} setWorkspace={setWorkspace} />}
              {step === 3 && <StepGoals ws={ws} setWorkspace={setWorkspace} showErrors={showErrors} />}
              {step === 4 && <StepAudience ws={ws} setWorkspace={setWorkspace} />}
              {step === 5 && <StepReview ws={ws} onEdit={(s) => { setShowErrors(false); setStep(s); }} />}
            </div>
          </div>

          {/* Footer bar */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 88, boxSizing: "border-box", padding: "0 48px", borderTop: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              {showBack && (
                <button type="button" onClick={handleBack} style={{ height: 48, padding: "0 18px 0 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)", color: "#ffffff", fontSize: 15, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
                  Back
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {showSkip && (
                <button type="button" onClick={handleSkip} style={{ height: 48, padding: "0 6px", border: 0, background: "transparent", color: "#ffffff", textDecoration: "underline", fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  Skip for now
                </button>
              )}
              <button
                type="button" onClick={handleNext}
                disabled={isLaunch && saving}
                style={{
                  height: 48, padding: "0 30px", borderRadius: 12, border: 0,
                  fontSize: 15, fontWeight: 600, fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  transition: "all 0.15s",
                  ...(!canNext && !isLaunch
                    ? { background: "rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.7)", cursor: "not-allowed" }
                    : { background: "#ffffff", color: "#0a66c2", boxShadow: "0 10px 26px rgba(6,42,92,0.28)", cursor: saving ? "progress" : "pointer" }),
                  ...(saving ? { opacity: 0.85 } : {}),
                }}
              >
                {saving && <svg className="spectr-spin" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a66c2" strokeWidth="3" strokeLinecap="round"><path d="M12 3a9 9 0 1 0 9 9" /></svg>}
                {nextLabel}
              </button>
            </div>
          </div>
        </section>
    </div>
  );
}

/* ── Step 1: Company ── */
function StepCompany({ ws, setWorkspace, showErrors, userId }: any) {
  const nameErr = showErrors && !ws.companyName.trim();
  const industryErr = showErrors && !ws.industry.trim();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, alignItems: "start" }}>
      {/* Company name */}
      <div>
        <label className="spectr-label">Company name</label>
        <input className="spectr-input" placeholder="Company name" value={ws.companyName}
          onChange={(e) => setWorkspace({ companyName: e.target.value })}
          style={{ border: nameErr ? "1px solid #d92d20" : undefined }} />
        {nameErr && <div style={{ marginTop: 6, fontSize: 13, color: "#ffd0cb" }}>Enter your company name</div>}
      </div>

      {/* Industry */}
      <div style={{ position: "relative" }}>
        <label className="spectr-label">Industry / sector</label>
        <IndustrySelector value={ws.industry} onChange={(v) => setWorkspace({ industry: v })} hasError={industryErr} />
        {industryErr && <div style={{ marginTop: 6, fontSize: 13, color: "#ffd0cb" }}>Choose a sector</div>}
      </div>

      {/* Sub-sector placeholder (empty to maintain 3-col layout) */}
      <div />

      {/* Company brief - full width */}
      <div style={{ gridColumn: "1 / -1" }}>
        <CompanyBrief ws={ws} setWorkspace={setWorkspace} userId={userId} />
      </div>

      {/* Primary platform */}
      <div style={{ gridColumn: "1 / -1" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Primary platform</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          {[
            { name: "LinkedIn", mark: "in", sel: true },
            { name: "Instagram", mark: "ig", sel: false },
            { name: "TikTok", mark: "tt", sel: false },
            { name: "YouTube", mark: "yt", sel: false },
          ].map((p) => (
            <div key={p.name} style={{
              display: "flex", alignItems: "center", gap: 12, height: 68, boxSizing: "border-box",
              padding: "0 14px", borderRadius: 14,
              background: p.sel ? "#0a66c2" : "rgba(255,255,255,0.12)",
              border: p.sel ? "2px solid #ffffff" : "1px solid rgba(255,255,255,0.34)",
              opacity: p.sel ? 1 : 0.7,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: p.sel ? "#1a7ec8" : "rgba(255,255,255,0.2)", color: "#ffffff" }}>
                {p.mark}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</div>
                {!p.sel && <div style={{ marginTop: 2, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Coming soon</div>}
              </div>
              {p.sel && (
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#0a66c2", border: "2px solid rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Starting from scratch toggle */}
      <div style={{ gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, boxSizing: "border-box", padding: "0 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.34)", background: "rgba(255,255,255,0.14)" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Are you starting from scratch?</div>
          <button type="button" role="switch" aria-checked={ws.startingFromScratch}
            onClick={() => setWorkspace({ startingFromScratch: !ws.startingFromScratch })}
            style={{ position: "relative", width: 46, height: 26, borderRadius: 13, border: 0, padding: 0, cursor: "pointer", background: ws.startingFromScratch ? "#0a66c2" : "#c3d4ec", transition: "background 0.15s" }}>
            <span style={{ position: "absolute", top: 3, left: ws.startingFromScratch ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#ffffff", boxShadow: "0 2px 6px rgba(0,0,0,0.25)", transition: "left 0.15s" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: Baseline ── */
function StepBaseline({ ws, setWorkspace }: any) {
  return (
    <div>
      <LinkedInUploadSlots ws={ws} setWorkspace={setWorkspace} />
      <div style={{ marginTop: 20 }}>
        <NumGrid ws={ws} setWorkspace={setWorkspace} kind="baseline" />
      </div>
    </div>
  );
}

/* ── Step 3: Goals ── */
function StepGoals({ ws, setWorkspace, showErrors }: any) {
  const goalErr = showErrors && !ws.goalDescription.trim();
  const requiredTargets = getRequiredTargets(ws.goalDescription);
  return (
    <div>
      <div>
        <label className="spectr-label">Goal description <span style={{ color: "#d92d20" }}>*</span></label>
        <textarea className="spectr-textarea" rows={4}
          placeholder="What do you want to achieve on LinkedIn in the next 12 weeks?"
          value={ws.goalDescription}
          onChange={(e) => setWorkspace({ goalDescription: e.target.value })}
          style={{ height: 112, border: goalErr ? "1px solid #d92d20" : undefined }} />
        {goalErr && <div style={{ marginTop: 6, fontSize: 13, color: "#ffd0cb" }}>Describe your goal to continue</div>}
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.18)", fontSize: 14, lineHeight: 1.45 }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5v.01" /></svg>
          <div>Your goal determines which targets are required. Be as specific as possible about what you want to achieve on LinkedIn.</div>
        </div>
      </div>

      <div style={{ marginTop: 26, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>12-week targets</div>
      <div style={{ marginTop: 14 }}>
        <NumGrid ws={ws} setWorkspace={setWorkspace} kind="targets" requiredTargets={requiredTargets} />
      </div>
    </div>
  );
}

/* ── Step 4: Audience ── */
function StepAudience({ ws, setWorkspace }: any) {
  return (
    <div>
      <div>
        <label className="spectr-label">Job titles</label>
        <input className="spectr-input" placeholder="For example: Head of Growth, Product Manager"
          value={ws.audience.jobTitles}
          onChange={(e) => setWorkspace({ audience: { ...ws.audience, jobTitles: e.target.value } })} />
      </div>

      <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        <div>
          <label className="spectr-label">Seniority level</label>
          <select className="spectr-input spectr-select" value={ws.audience.seniority}
            onChange={(e) => setWorkspace({ audience: { ...ws.audience, seniority: e.target.value } })}>
            <option value="">Select level...</option>
            {SENIORITY_LEVELS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="spectr-label">Company size</label>
          <select className="spectr-input spectr-select" value={ws.audience.companySize}
            onChange={(e) => setWorkspace({ audience: { ...ws.audience, companySize: e.target.value } })}>
            <option value="">Select size...</option>
            {COMPANY_SIZES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <label className="spectr-label" style={{ margin: 0 }}>Audience description</label>
          <span style={{ height: 20, padding: "0 8px", borderRadius: 999, background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.88)", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>Optional</span>
        </div>
        <textarea className="spectr-textarea" rows={6} style={{ height: 200 }}
          placeholder="Anything else about the people you want to reach."
          value={ws.audience.description}
          onChange={(e) => setWorkspace({ audience: { ...ws.audience, description: e.target.value } })} />
      </div>
    </div>
  );
}

/* ── Step 5: Review ── */
function StepReview({ ws, onEdit }: { ws: any; onEdit: (step: number) => void }) {
  const row = (label: string, value: string) => ({ label, value, filled: String(value || "").trim() !== "" });

  const briefVal = ws.companyPdfUrl ? ws.companyPdfName || "Uploaded PDF" : ws.companyDescription;
  const tSet = ["followers", "followerGrowth", "weeklyImpressions", "engagementRate", "monthlyVisitors", "weeklyPageSearches"]
    .filter((k) => String(ws.targets[k] || "").trim() !== "").length;

  const sections = [
    {
      title: "Company", editStep: 1,
      rows: [row("Company", ws.companyName), row("Industry", ws.industry), row("Brief", briefVal), row("Primary platform", "LinkedIn")],
    },
    {
      title: "Goals", editStep: 3,
      rows: [row("Goal", ws.goalDescription), row("12-week targets", tSet ? `${tSet} of 6 set` : "")],
    },
    {
      title: "Audience", editStep: 4,
      rows: [row("Job titles", ws.audience.jobTitles), row("Seniority", ws.audience.seniority), row("Company size", ws.audience.companySize), row("Audience description", ws.audience.description)],
    },
  ];

  const allRows = sections.flatMap((s) => s.rows);
  const doneCount = allRows.filter((r) => r.filled).length;
  const totalCount = allRows.length;

  return (
    <div>
      {/* Completeness bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.34)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{doneCount} of {totalCount} details added</div>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
          <div style={{ width: `${Math.round(doneCount / totalCount * 100)}%`, height: "100%", borderRadius: 4, background: "#12b76a" }} />
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", whiteSpace: "nowrap" }}>You can add the rest later</div>
      </div>

      {/* 3-column review cards */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "stretch" }}>
        {sections.map((sec) => (
          <div key={sec.title} style={{ boxSizing: "border-box", padding: 20, borderRadius: 16, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.34)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{sec.title}</div>
              <button type="button" onClick={() => onEdit(sec.editStep)}
                style={{ height: 28, padding: "0 10px", borderRadius: 8, border: 0, background: "rgba(255,255,255,0.2)", color: "#ffffff", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                Edit
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              {sec.rows.map((r) => (
                <div key={r.label} style={{ padding: "13px 0", borderTop: "1px solid rgba(255,255,255,0.2)" }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{r.label}</div>
                  {r.filled ? (
                    <div style={{ marginTop: 3, fontSize: 14, lineHeight: 1.4, fontWeight: 500, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{r.value}</div>
                  ) : (
                    <div style={{ marginTop: 5, display: "inline-flex", height: 22, padding: "0 9px", alignItems: "center", borderRadius: 999, background: "#fffaeb", color: "#b54708", fontSize: 12, fontWeight: 600 }}>Not added</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Company brief toggle ── */
function CompanyBrief({ ws, setWorkspace, userId }: any) {
  const [mode, setMode] = useState<"text" | "pdf">(ws.companyPdfUrl ? "pdf" : "text");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const switchMode = (m: "text" | "pdf") => {
    setMode(m); setUploadError("");
    if (m === "text") setWorkspace({ companyPdfUrl: "", companyPdfName: "" });
    else setWorkspace({ companyDescription: "" });
  };

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") { setUploadError("Please upload a PDF file."); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError("File must be under 10 MB."); return; }
    setUploadError(""); setUploading(true);
    const path = `${userId}/company-brief-${Date.now()}.pdf`;
    const { error } = await supabase.storage.from("company-docs").upload(path, file, { upsert: true });
    if (error) { setUploadError(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("company-docs").getPublicUrl(path);
    setWorkspace({ companyPdfUrl: data.publicUrl, companyPdfName: file.name });
    setUploading(false);
  };

  const clearPdf = () => { setWorkspace({ companyPdfUrl: "", companyPdfName: "" }); if (fileRef.current) fileRef.current.value = ""; };

  const seg = (on: boolean) => ({
    height: 34, padding: "0 16px", border: 0, borderRadius: 9, fontSize: 13, fontWeight: 600 as const,
    fontFamily: "inherit", cursor: "pointer" as const,
    ...(on ? { background: "#0a66c2", color: "#ffffff", boxShadow: "0 4px 12px rgba(10,102,194,0.3)" } : { background: "transparent", color: "rgba(255,255,255,0.88)" }),
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Company / Product brief</div>
          <div style={{ marginTop: 3, fontSize: 13, color: "rgba(255,255,255,0.88)" }}>SPECTR reads this to understand what you do and generate on-brand content.</div>
        </div>
        <div style={{ display: "flex", padding: 3, borderRadius: 12, background: "rgba(255,255,255,0.2)", flexShrink: 0 }}>
          <button type="button" onClick={() => switchMode("text")} style={seg(mode === "text")}>Write description</button>
          <button type="button" onClick={() => switchMode("pdf")} style={seg(mode === "pdf")}>Upload PDF</button>
        </div>
      </div>

      <div style={{ marginTop: 12, height: 150 }}>
        {mode === "text" && (
          <textarea className="spectr-textarea" style={{ height: 150 }}
            placeholder="Describe what your company does, who it serves and how it sounds."
            value={ws.companyDescription}
            onChange={(e) => setWorkspace({ companyDescription: e.target.value })} />
        )}
        {mode === "pdf" && !ws.companyPdfUrl && (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ width: "100%", height: 150, boxSizing: "border-box", borderRadius: 14, border: "1.5px dashed rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, cursor: "pointer", fontFamily: "inherit", color: "#ffffff" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "#ffffff", boxShadow: "0 6px 16px rgba(10,102,194,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0a66c2" }}>
              <Upload size={24} />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{uploading ? "Uploading..." : "Drop your PDF here or "}<span style={{ textDecoration: "underline" }}>browse</span></div>
              <div style={{ marginTop: 3, fontSize: 13, color: "rgba(255,255,255,0.88)" }}>PDF only, up to 10 MB</div>
            </div>
          </button>
        )}
        {mode === "pdf" && ws.companyPdfUrl && (
          <div style={{ height: 150, boxSizing: "border-box", borderRadius: 14, border: "1px solid rgba(255,255,255,0.34)", background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", gap: 16, padding: "0 22px" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#fef3f2", color: "#d92d20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>PDF</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{ws.companyPdfName}</div>
              <div style={{ marginTop: 4, fontSize: 13, color: "rgba(255,255,255,0.88)" }}>Uploaded</div>
              <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, height: 24, padding: "0 10px", borderRadius: 999, background: "#ecfdf3", color: "#067647", fontSize: 12, fontWeight: 600 }}>
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                Uploaded
              </div>
            </div>
            <button type="button" onClick={clearPdf} aria-label="Remove file"
              style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.16)", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              <X size={16} />
            </button>
          </div>
        )}
        {uploadError && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#ffd0cb" }}>{uploadError}</p>}
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>
    </div>
  );
}

/* ── Industry selector ── */
function IndustrySelector({ value, onChange, hasError }: { value: string; onChange: (v: string) => void; hasError?: boolean }) {
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

  const handleSector = (s: string) => { setSector(s); setSub(""); setCustom(""); onChange(s === "Other" ? "" : s); };
  const handleSub = (s: string) => { setSub(s); setCustom(""); onChange(s === "Other" ? "" : s); };
  const handleCustom = (v: string) => { setCustom(v); onChange(v); };

  const showSub = sector !== "" && sector !== "Other";
  const showCustom = sector === "Other" || sub === "Other";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <select className="spectr-input spectr-select" value={sector} onChange={(e) => handleSector(e.target.value)}
        style={{ border: hasError && !sector ? "1px solid #d92d20" : undefined }}>
        <option value="">Select sector...</option>
        {Object.keys(INDUSTRIES).map((s) => <option key={s} value={s}>{s}</option>)}
        <option value="Other">Other</option>
      </select>
      {showSub && (
        <select className="spectr-input spectr-select" value={sub} onChange={(e) => handleSub(e.target.value)}>
          <option value="">Select industry...</option>
          {INDUSTRIES[sector].map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="Other">Other</option>
        </select>
      )}
      {showCustom && (
        <input className="spectr-input" placeholder="Type your industry / sector..." value={custom}
          onChange={(e) => handleCustom(e.target.value)} autoFocus />
      )}
    </div>
  );
}

/* ── Numeric grid for baseline / targets ── */
function NumGrid({ ws, setWorkspace, kind, requiredTargets }: { ws: any; setWorkspace: any; kind: "baseline" | "targets"; requiredTargets?: Set<string> }) {
  const fields = [
    { key: "followers", label: kind === "baseline" ? "Current Followers" : "Followers target", unit: "followers", help: "Total followers on your company page", required: kind === "baseline" },
    { key: "followerGrowth", label: kind === "baseline" ? "Avg Weekly Follower Growth" : "Weekly follower growth target", unit: "per week", help: kind === "baseline" ? "Average new followers per week" : "Target average new followers per week" },
    { key: "weeklyImpressions", label: kind === "baseline" ? "Avg Weekly Impressions" : "Weekly impressions target", unit: "per week", help: "Average impressions across all posts per week", optional: kind === "baseline" },
    { key: "engagementRate", label: kind === "baseline" ? "Avg Engagement Rate (%)" : "Engagement rate target", unit: "%", help: "Likes + comments + shares / impressions" },
    { key: "monthlyVisitors", label: kind === "baseline" ? "Monthly Profile Visitors" : "Monthly visitors target", unit: "per month", help: "Unique visitors to your company page" },
  ];

  const badge = (key: string, baseOpt?: boolean) => {
    if (kind === "targets" && requiredTargets) {
      if (requiredTargets.has(key)) return <span style={{ color: "#d92d20" }}>*</span>;
      return <span style={{ height: 20, padding: "0 8px", borderRadius: 999, background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.88)", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>Optional</span>;
    }
    if (baseOpt) return <span style={{ height: 20, padding: "0 8px", borderRadius: 999, background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.88)", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>Optional</span>;
    return null;
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "18px 20px" }}>
      {fields.map((f) => (
        <div key={f.key}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <label className="spectr-label" style={{ margin: 0 }}>{f.label}</label>
            {!f.required && badge(f.key, f.optional)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 48, boxSizing: "border-box", padding: "0 16px", borderRadius: 12, background: "rgba(255,255,255,0.18)", border: "1px solid transparent" }}
            onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#ffffff"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.28)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(255,255,255,0.35)"; }}
            onBlur={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "transparent"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.18)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
            <input type="text" inputMode="numeric" placeholder="0"
              value={ws[kind][f.key]}
              onChange={(e) => setWorkspace({ [kind]: { ...ws[kind], [f.key]: e.target.value } })}
              style={{ flex: 1, border: 0, outline: "none", background: "transparent", color: "#ffffff", fontSize: 15, fontFamily: "inherit" }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" }}>{f.unit}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.4, color: "rgba(255,255,255,0.8)" }}>{f.help}</div>
        </div>
      ))}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <label className="spectr-label" style={{ margin: 0 }}>{kind === "baseline" ? "Weekly Page Searches" : "Weekly page searches target"}</label>
          {badge("weeklyPageSearches", kind === "baseline")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 48, boxSizing: "border-box", padding: "0 16px", borderRadius: 12, background: "rgba(255,255,255,0.18)", border: "1px solid transparent" }}
          onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#ffffff"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.28)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(255,255,255,0.35)"; }}
          onBlur={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "transparent"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.18)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
          <input type="text" inputMode="numeric" placeholder="0"
            value={ws[kind].weeklyPageSearches}
            onChange={(e) => setWorkspace({ [kind]: { ...ws[kind], weeklyPageSearches: e.target.value } })}
            style={{ flex: 1, border: 0, outline: "none", background: "transparent", color: "#ffffff", fontSize: 15, fontFamily: "inherit" }} />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" }}>per week</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.4, color: "rgba(255,255,255,0.8)" }}>
          {kind === "baseline" ? "Company page → Analytics → Overview → Search Appearances." : "How many times your page surfaces in LinkedIn search per week"}
        </div>
      </div>
    </div>
  );
}
