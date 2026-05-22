import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useApp } from "@/lib/spectr-store";
import { AppShell } from "@/components/spectr/AppShell";
import { LinkedInUploadSlots } from "@/components/spectr/LinkedInUpload";

export const Route = createFileRoute("/settings")({ component: () => <AppShell><Settings /></AppShell> });

const SIZES = ["Startup", "SMB", "Mid-Market", "Enterprise", "All Sizes"];

function Settings() {
  const { state, setWorkspace } = useApp();
  const ws = state.workspace;

  const save = () => toast.success("Workspace saved.");

  const num = (kind: "baseline" | "targets", key: string, label: string, hint?: string) => (
    <div>
      <label className="spectr-label">{label}</label>
      <input className="spectr-input" type="number"
        value={(ws as any)[kind][key]}
        onChange={(e) => setWorkspace({ [kind]: { ...(ws as any)[kind], [key]: e.target.value } } as any)} />
      {hint && <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>{hint}</p>}
    </div>
  );

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <Section title="Company & Workspace">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="spectr-label">Company Name</label>
            <input className="spectr-input" value={ws.companyName} onChange={(e) => setWorkspace({ companyName: e.target.value })} /></div>
          <div><label className="spectr-label">Industry</label>
            <input className="spectr-input" value={ws.industry} onChange={(e) => setWorkspace({ industry: e.target.value })} /></div>
        </div>
        <div className="mt-4">
          <label className="spectr-label">Primary Platform</label>
          <div className="grid grid-cols-4 gap-2">
            {[{ n: "LinkedIn", on: true }, { n: "Instagram" }, { n: "TikTok" }, { n: "YouTube" }].map((p) => (
              <div key={p.n} className="rounded-md p-3 text-center text-xs font-semibold"
                style={{
                  border: `2px solid ${p.on ? "var(--color-primary)" : "var(--color-border)"}`,
                  background: p.on ? "rgba(10,102,194,0.06)" : "var(--color-surface)",
                  color: p.on ? "var(--color-primary)" : "var(--color-text-secondary)",
                  opacity: p.on ? 1 : 0.6,
                }}>{p.n}{!p.on && <div className="text-[9px] mt-1">Coming Soon</div>}</div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Target Audience">
        <div className="space-y-4">
          <div><label className="spectr-label">Job Titles (comma-separated)</label>
            <input className="spectr-input" value={ws.audience.jobTitles}
              onChange={(e) => setWorkspace({ audience: { ...ws.audience, jobTitles: e.target.value } })} /></div>
          <div><label className="spectr-label">Seniority Level</label>
            <input className="spectr-input" value={ws.audience.seniority}
              onChange={(e) => setWorkspace({ audience: { ...ws.audience, seniority: e.target.value } })} /></div>
          <div><label className="spectr-label">Company Size</label>
            <select className="spectr-input" value={ws.audience.companySize}
              onChange={(e) => setWorkspace({ audience: { ...ws.audience, companySize: e.target.value } })}>
              <option value="">Select size...</option>
              {SIZES.map((s) => <option key={s}>{s}</option>)}
            </select></div>
          <div><label className="spectr-label">Audience Description</label>
            <textarea className="spectr-textarea" rows={3} value={ws.audience.description}
              onChange={(e) => setWorkspace({ audience: { ...ws.audience, description: e.target.value } })} /></div>
        </div>
      </Section>

      <Section title="Growth Goals & Targets">
        <div>
          <label className="spectr-label">Goal Description</label>
          <textarea className="spectr-textarea" rows={3} value={ws.goalDescription}
            onChange={(e) => setWorkspace({ goalDescription: e.target.value })} />
        </div>
        <div className="mt-6">
          <LinkedInUploadSlots ws={ws} setWorkspace={setWorkspace} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          {num("baseline", "followers", "Followers Baseline")}
          {num("targets", "followers", "Followers Target")}
          {num("baseline", "weeklyImpressions", "Weekly Impressions Baseline", "Company page → Analytics → Content. Pick a date range, take the total impressions, and divide by the number of weeks.")}
          {num("targets", "weeklyImpressions", "Weekly Impressions Target")}
          {num("baseline", "engagementRate", "Engagement Rate Baseline (%)")}
          {num("targets", "engagementRate", "Engagement Rate Target (%)")}
          {num("baseline", "monthlyVisitors", "Monthly Visitors Baseline")}
          {num("targets", "monthlyVisitors", "Monthly Visitors Target")}
          {num("baseline", "weeklyPageSearches", "Weekly Page Searches Baseline", "Company page → Analytics → Overview → Search Appearances.")}
          {num("targets", "weeklyPageSearches", "Weekly Page Searches Target")}
        </div>
      </Section>

      <button onClick={save} className="spectr-btn-primary">Save Settings</button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="spectr-card p-6 mb-6">
      <h2 className="font-bold mb-4">{title}</h2>
      {children}
    </section>
  );
}
