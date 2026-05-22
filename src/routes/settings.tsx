import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp, type Workspace } from "@/lib/spectr-store";
import { AppShell } from "@/components/spectr/AppShell";
import { LinkedInUploadSlots } from "@/components/spectr/LinkedInUpload";
import supabase from "@/lib/supabase";

export const Route = createFileRoute("/settings")({ component: () => <AppShell><Settings /></AppShell> });

const SIZES = ["Startup", "SMB", "Mid-Market", "Enterprise", "All Sizes"];

function Settings() {
  const { state, update } = useApp();
  const ws = state.workspace;
  const companyId = ws.companyId;
  const userId = state.user?.id;

  const [saving, setSaving] = useState(false);

  // ── On mount: re-hydrate from Supabase so the form always shows persisted data ──
  useEffect(() => {
    if (!companyId || !userId) return;

    Promise.all([
      supabase.from("companies").select("name").eq("id", companyId).single(),
      supabase.from("workspaces")
        .select("industry, baseline, targets, goal_description, audience")
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]).then(([{ data: co }, { data: wsd }]) => {
      if (!co && !wsd) return;
      update({
        workspace: {
          ...ws,
          companyName: co?.name ?? ws.companyName,
          industry: wsd?.industry ?? ws.industry,
          baseline: { ...ws.baseline, ...(wsd?.baseline ?? {}) },
          targets: { ...ws.targets, ...(wsd?.targets ?? {}) },
          goalDescription: wsd?.goal_description ?? ws.goalDescription,
          audience: { ...ws.audience, ...(wsd?.audience ?? {}) },
        },
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // ── Field helpers ─────────────────────────────────────────────────────────────

  const setWs = (patch: Partial<Workspace>) =>
    update({ workspace: { ...ws, ...patch } });

  const num = (kind: "baseline" | "targets", key: string, label: string, hint?: string) => (
    <div>
      <label className="spectr-label">{label}</label>
      <input
        className="spectr-input"
        type="number"
        value={(ws as any)[kind][key]}
        onChange={(e) => setWs({ [kind]: { ...(ws as any)[kind], [key]: e.target.value } } as any)}
      />
      {hint && <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>{hint}</p>}
    </div>
  );

  // ── Save to Supabase ──────────────────────────────────────────────────────────

  const save = async () => {
    if (!companyId || !userId) {
      toast.error("No active company. Select a company first.");
      return;
    }

    setSaving(true);

    const [{ error: coErr }, { error: wsErr }] = await Promise.all([
      // Update company name
      supabase
        .from("companies")
        .update({ name: ws.companyName })
        .eq("id", companyId),

      // Upsert workspace settings
      supabase
        .from("workspaces")
        .upsert(
          {
            company_id: companyId,
            user_id: userId,
            industry: ws.industry,
            primary_platform: ws.primaryPlatform,
            baseline: ws.baseline,
            targets: ws.targets,
            goal_description: ws.goalDescription,
            audience: ws.audience,
            setup_complete: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id,user_id" }
        ),
    ]);

    setSaving(false);

    if (coErr || wsErr) {
      toast.error((coErr ?? wsErr)!.message || "Failed to save settings.");
      return;
    }

    toast.success("Settings saved.");
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <Section title="Company & Workspace">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="spectr-label">Company Name</label>
            <input
              className="spectr-input"
              value={ws.companyName}
              onChange={(e) => setWs({ companyName: e.target.value })}
            />
          </div>
          <div>
            <label className="spectr-label">Industry</label>
            <input
              className="spectr-input"
              value={ws.industry}
              onChange={(e) => setWs({ industry: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="spectr-label">Primary Platform</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { n: "LinkedIn", on: true },
              { n: "Instagram" },
              { n: "TikTok" },
              { n: "YouTube" },
            ].map((p) => (
              <div
                key={p.n}
                className="rounded-md p-3 text-center text-xs font-semibold"
                style={{
                  border: `2px solid ${p.on ? "var(--color-primary)" : "var(--color-border)"}`,
                  background: p.on ? "rgba(10,102,194,0.06)" : "var(--color-surface)",
                  color: p.on ? "var(--color-primary)" : "var(--color-text-secondary)",
                  opacity: p.on ? 1 : 0.6,
                }}
              >
                {p.n}
                {!p.on && <div className="text-[9px] mt-1">Coming Soon</div>}
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Target Audience">
        <div className="space-y-4">
          <div>
            <label className="spectr-label">Job Titles (comma-separated)</label>
            <input
              className="spectr-input"
              value={ws.audience.jobTitles}
              onChange={(e) => setWs({ audience: { ...ws.audience, jobTitles: e.target.value } })}
            />
          </div>
          <div>
            <label className="spectr-label">Seniority Level</label>
            <input
              className="spectr-input"
              value={ws.audience.seniority}
              onChange={(e) => setWs({ audience: { ...ws.audience, seniority: e.target.value } })}
            />
          </div>
          <div>
            <label className="spectr-label">Company Size</label>
            <select
              className="spectr-input"
              value={ws.audience.companySize}
              onChange={(e) => setWs({ audience: { ...ws.audience, companySize: e.target.value } })}
            >
              <option value="">Select size...</option>
              {SIZES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="spectr-label">
              Audience Description
              <span className="ml-2 text-xs font-normal" style={{ color: "var(--color-text-secondary)" }}>
                (optional)
              </span>
            </label>
            <textarea
              className="spectr-textarea"
              rows={3}
              value={ws.audience.description}
              onChange={(e) => setWs({ audience: { ...ws.audience, description: e.target.value } })}
            />
          </div>
        </div>
      </Section>

      <Section title="Growth Goals & Targets">
        <div>
          <label className="spectr-label">Goal Description</label>
          <textarea
            className="spectr-textarea"
            rows={3}
            value={ws.goalDescription}
            onChange={(e) => setWs({ goalDescription: e.target.value })}
          />
        </div>
        <div className="mt-6">
          <LinkedInUploadSlots ws={ws} setWorkspace={(patch) => setWs(patch)} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          {num("baseline", "followers", "Followers Baseline")}
          {num("targets", "followers", "Followers Target")}
          {num("baseline", "followerGrowth", "Follower Growth Baseline",
            "Auto-filled from your Followers export. Average new followers gained per week.")}
          {num("targets", "followerGrowth", "Follower Growth Target")}
          {num("baseline", "weeklyImpressions", "Weekly Impressions Baseline",
            "Company page → Analytics → Content. Pick a date range, take the total impressions, and divide by the number of weeks.")}
          {num("targets", "weeklyImpressions", "Weekly Impressions Target")}
          {num("baseline", "engagementRate", "Engagement Rate Baseline (%)")}
          {num("targets", "engagementRate", "Engagement Rate Target (%)")}
          {num("baseline", "monthlyVisitors", "Monthly Visitors Baseline")}
          {num("targets", "monthlyVisitors", "Monthly Visitors Target")}
          {num("baseline", "weeklyPageSearches", "Weekly Page Searches Baseline",
            "Company page → Analytics → Overview → Search Appearances.")}
          {num("targets", "weeklyPageSearches", "Weekly Page Searches Target")}
        </div>
      </Section>

      <button onClick={save} disabled={saving} className="spectr-btn-primary">
        {saving ? "Saving…" : "Save Settings"}
      </button>
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
