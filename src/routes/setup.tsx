import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import { SpectrLogo } from "@/components/spectr/Logo";
import { LinkedInUploadSlots } from "@/components/spectr/LinkedInUpload";
import supabase from "@/lib/supabase";

export const Route = createFileRoute("/setup")({ component: SetupPage });

const COMPANY_SIZES = ["Startup", "SMB", "Mid-Market", "Enterprise", "All Sizes"];

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
    }

    update({ setupComplete: true });
    navigate({ to: "/transform" });
  };

  if (!state.isAuthenticated) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: "var(--color-surface)" }}>
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
        {step === 1 && <Step1 ws={ws} setWorkspace={setWorkspace} onNext={next} />}
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
                background: done || active ? "var(--color-primary)" : "white",
                color: done || active ? "white" : "var(--color-text-secondary)",
                border: `1px solid ${done || active ? "var(--color-primary)" : "var(--color-border)"}`,
              }}>
              {done ? <Check size={14} /> : n}
            </div>
            {n < total && <div style={{ width: 32, height: 2, background: done ? "var(--color-primary)" : "var(--color-border)" }} />}
          </div>
        );
      })}
    </div>
  );
}

function H({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold">{title}</h2>
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

function Step1({ ws, setWorkspace, onNext }: any) {
  const can = ws.companyName.trim() && ws.industry.trim();
  return (
    <>
      <H title="Let's set up your workspace" sub="SPECTR will use this to calibrate every piece of content it generates." />
      <div className="space-y-4">
        <div><label className="spectr-label">Company Name</label>
          <input className="spectr-input" placeholder="e.g. Chirality" value={ws.companyName} onChange={(e) => setWorkspace({ companyName: e.target.value })} /></div>
        <div><label className="spectr-label">Industry / Sector</label>
          <input className="spectr-input" placeholder="e.g. Clean Energy, Oil & Gas" value={ws.industry} onChange={(e) => setWorkspace({ industry: e.target.value })} /></div>
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
        <label className="flex items-center justify-between p-3 rounded-md" style={{ background: "var(--color-surface)" }}>
          <span className="text-sm font-medium">Are you starting from scratch?</span>
          <input type="checkbox" checked={ws.startingFromScratch} onChange={(e) => setWorkspace({ startingFromScratch: e.target.checked })}
            className="h-5 w-9 appearance-none rounded-full transition-colors relative cursor-pointer"
            style={{ background: ws.startingFromScratch ? "var(--color-primary)" : "#ccc" }} />
        </label>
      </div>
      <Nav onNext={onNext} disabled={!can} />
    </>
  );
}

function NumGrid({ ws, setWorkspace, kind }: { ws: any; setWorkspace: any; kind: "baseline" | "targets" }) {
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
  return (
    <div className="grid grid-cols-2 gap-4">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="spectr-label flex items-center gap-2">
            <span className="flex items-center gap-1">
              {f.label}
              {f.required && <span style={{ color: "var(--color-destructive)" }}>*</span>}
            </span>
            {f.optional && (
              <span className="text-[11px] font-medium px-1.5 py-px rounded"
                style={{ background: "rgba(10,102,194,0.08)", color: "var(--color-primary)" }}>
                Optional
              </span>
            )}
          </label>
          <input type="number" className="spectr-input" value={ws[kind][f.key]} onChange={(e) => setWorkspace({ [kind]: { ...ws[kind], [f.key]: e.target.value } })} />
          <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>{f.hint}</p>
        </div>
      ))}
      <div className="col-span-2">
        <label className="spectr-label flex items-center gap-2">
          {kind === "baseline" ? "Weekly Page Searches" : "Weekly Page Searches Target"}
          {kind === "baseline" && (
            <span className="text-[11px] font-medium px-1.5 py-px rounded"
              style={{ background: "rgba(10,102,194,0.08)", color: "var(--color-primary)" }}>
              Optional
            </span>
          )}
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
  return (
    <>
      <H title="What does success look like?" sub="Set your 12-week targets. SPECTR will track your progress against these." />
      <div className="space-y-4">
        <div>
          <label className="spectr-label">Goal Description</label>
          <textarea className="spectr-textarea" rows={3} placeholder="e.g. Connect with decision makers in oil & gas and energy companies to build credibility and generate client pipeline"
            value={ws.goalDescription} onChange={(e) => setWorkspace({ goalDescription: e.target.value })} />
        </div>
        <h3 className="text-sm font-bold mt-4">12-Week Targets</h3>
        <NumGrid ws={ws} setWorkspace={setWorkspace} kind="targets" />
      </div>
      <Nav onBack={onBack} onNext={onNext} disabled={!can} />
    </>
  );
}

function Step4({ ws, setWorkspace, onNext, onBack }: any) {
  return (
    <>
      <H title="Who are you trying to reach?" sub="SPECTR uses this to calibrate every content output to your exact audience." />
      <div className="space-y-4">
        <div><label className="spectr-label">Job Titles</label>
          <input className="spectr-input" placeholder="e.g. VP, Director, Operations Manager"
            value={ws.audience.jobTitles} onChange={(e) => setWorkspace({ audience: { ...ws.audience, jobTitles: e.target.value } })} /></div>
        <div><label className="spectr-label">Seniority Level</label>
          <input className="spectr-input" placeholder="e.g. Mid-level to Senior"
            value={ws.audience.seniority} onChange={(e) => setWorkspace({ audience: { ...ws.audience, seniority: e.target.value } })} /></div>
        <div><label className="spectr-label">Company Size</label>
          <select className="spectr-input" value={ws.audience.companySize}
            onChange={(e) => setWorkspace({ audience: { ...ws.audience, companySize: e.target.value } })}>
            <option value="">Select size...</option>
            {COMPANY_SIZES.map((s) => <option key={s}>{s}</option>)}
          </select></div>
        <div><label className="spectr-label">Audience Description</label>
          <textarea className="spectr-textarea" rows={3} placeholder="e.g. Decision makers at mid-market energy companies evaluating carbon capture solutions"
            value={ws.audience.description} onChange={(e) => setWorkspace({ audience: { ...ws.audience, description: e.target.value } })} /></div>
      </div>
      <Nav onBack={onBack} onNext={onNext} nextLabel="Review" />
    </>
  );
}

function Complete({ ws, onLaunch, saving }: { ws: any; onLaunch: () => void; saving?: boolean }) {
  const rows: [string, string][] = [
    ["Company", ws.companyName],
    ["Industry", ws.industry],
    ["Primary Platform", ws.primaryPlatform],
    ["Goal", ws.goalDescription || "—"],
    ["Job Titles", ws.audience.jobTitles || "—"],
    ["Seniority", ws.audience.seniority || "—"],
    ["Company Size", ws.audience.companySize || "—"],
    ["Followers Target", ws.targets.followers || "—"],
  ];
  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <div className="rounded-full flex items-center justify-center mb-4"
          style={{ background: "var(--color-success)", width: 64, height: 64 }}>
          <Check size={36} color="white" />
        </div>
        <h2 className="text-2xl font-bold">You're all set</h2>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>Review your workspace and launch SPECTR.</p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 p-4 rounded-md" style={{ background: "var(--color-surface)" }}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>{k}</div>
            <div className="text-sm mt-0.5 truncate">{v}</div>
          </div>
        ))}
      </div>
      <button onClick={onLaunch} disabled={saving} className="spectr-btn-primary w-full mt-6">
        {saving ? "Saving…" : "Launch SPECTR"}
      </button>
    </div>
  );
}
