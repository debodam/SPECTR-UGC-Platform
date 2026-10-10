import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, Upload, X } from "lucide-react";
import { useApp, type Workspace } from "@/lib/spectr-store";
import { AppShell } from "@/components/spectr/AppShell";
import { LinkedInUploadSlots } from "@/components/spectr/LinkedInUpload";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import supabase from "@/lib/supabase";
import { deleteAccount as deleteAccountFn } from "@/lib/delete-account-fn";

export const Route = createFileRoute("/settings")({ component: () => <AppShell><Settings /></AppShell> });

const SIZES = ["Startup", "SMB", "Mid-Market", "Enterprise", "All Sizes"];

function resizeToDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

function Settings() {
  const { state, update } = useApp();
  const navigate = useNavigate();
  const ws = state.workspace;
  const companyId = ws.companyId;
  const userId = state.user?.id;

  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    if (!userId) return;
    setDeleting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setDeleting(false); toast.error("No active session."); return; }
    const result = await deleteAccountFn({ data: { token: session.access_token } });
    if (result.error) { setDeleting(false); toast.error(result.error); return; }
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  // ── On mount: re-hydrate from Supabase so the form always shows persisted data ──
  useEffect(() => {
    if (!companyId || !userId) return;

    Promise.all([
      supabase.from("companies").select("name, logo_url").eq("id", companyId).single(),
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
          companyLogoUrl: co?.logo_url ?? ws.companyLogoUrl ?? "",
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

  // ── Logo upload ───────────────────────────────────────────────────────────────

  const uploadLogo = async (file: File) => {
    if (!companyId) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file."); return; }

    setLogoUploading(true);

    const dataUrl = await resizeToDataUrl(file, 256);

    const { error } = await supabase.from("companies").update({ logo_url: dataUrl }).eq("id", companyId);
    if (error) { toast.error("Failed to save logo."); setLogoUploading(false); return; }

    setWs({ companyLogoUrl: dataUrl });
    setLogoUploading(false);
    toast.success("Logo updated.");
  };

  const removeLogo = async () => {
    if (!companyId) return;
    await supabase.from("companies").update({ logo_url: null }).eq("id", companyId);
    setWs({ companyLogoUrl: "" });
    toast.success("Logo removed.");
  };

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
      <h1 className="spectr-display mb-6" style={{ fontSize: 28 }}>Settings</h1>

      <Section title="Company & Workspace">
        {/* Logo uploader */}
        <div className="flex items-center gap-5 mb-6 pb-6" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={logoUploading}
            className="relative w-[72px] h-[72px] rounded-full flex items-center justify-center overflow-hidden shrink-0 transition-opacity hover:opacity-80"
            style={{ background: "rgba(10,102,194,0.09)", border: "2px dashed var(--color-border)" }}
            title="Upload logo"
          >
            {logoUploading ? (
              <span className="text-[10px] font-medium" style={{ color: "var(--color-text-secondary)" }}>...</span>
            ) : ws.companyLogoUrl ? (
              <img src={ws.companyLogoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Building2 size={28} style={{ color: "var(--color-primary)" }} />
            )}
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full"
              style={{ background: "rgba(0,0,0,0.35)" }}
            >
              <Upload size={16} color="white" />
            </div>
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }}
          />
          <div>
            <p className="text-sm font-semibold mb-1">Company Logo</p>
            <p className="text-xs mb-2" style={{ color: "var(--color-text-secondary)" }}>
              Shown on the workspace selector and companies page. Any image — auto-resized.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="spectr-btn-secondary text-xs"
                style={{ height: 30, padding: "0 12px", fontSize: 12 }}
              >
                {ws.companyLogoUrl ? "Change" : "Upload"}
              </button>
              {ws.companyLogoUrl && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <X size={12} /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

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
                  boxShadow: p.on ? "var(--glow-primary-sm)" : "none",
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

      <section className="spectr-card p-6 mt-6" style={{ borderColor: "#fca5a5", border: "1px solid #fca5a5" }}>
        <h2 className="font-bold mb-1" style={{ color: "#dc2626" }}>Danger Zone</h2>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="text-sm font-semibold px-4 py-2 rounded-md transition-colors hover:opacity-90"
          style={{ background: "#dc2626", color: "white" }}
        >
          Delete Account
        </button>
      </section>

      <AlertDialog open={showDeleteConfirm} onOpenChange={(o) => !deleting && setShowDeleteConfirm(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account, all companies, workspaces, and content data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAccount}
              disabled={deleting}
              className="hover:opacity-90"
              style={{ background: "#dc2626", color: "white" }}
            >
              {deleting ? "Deleting…" : "Yes, delete my account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
