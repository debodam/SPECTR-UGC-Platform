import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppGate, AppHeader, AppRail } from "@/components/spectr/AppChrome";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp, type Workspace } from "@/lib/spectr-store";
import { LinkedInUploadSlots } from "@/components/spectr/LinkedInUpload";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import supabase from "@/lib/supabase";
import { createGrowthPlan } from "@/lib/growth-service";
import { errMessage, friendlyError } from "@/lib/utils";
import { deleteAccount as deleteAccountFn } from "@/lib/delete-account-fn";
import { DemoLock } from "@/demo/DemoLock";

export const Route = createFileRoute("/settings")({
  component: () => (
    <AppGate>
      <Settings />
    </AppGate>
  ),
});

const SIZES = ["Startup", "SMB", "Mid-Market", "Enterprise", "All Sizes"];
const TABS: [string, string, string][] = [
  ["company", "Company and workspace", "Manage your company name, logo and primary platform."],
  ["audience", "Audience", "Define who you are creating content for."],
  ["goals", "Growth goals", "Set your goal and upload LinkedIn data to auto-fill baselines."],
  ["targets", "Targets", "Set baseline and target numbers for each key metric."],
  ["account", "Account", "Danger zone and account management."],
];

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
      const w = img.width * scale,
        h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function Settings() {
  const { state, update } = useApp();
  const navigate = useNavigate();
  const ws = state.workspace;
  const companyId = ws.companyId;
  const userId = state.user?.id;

  const [tab, setTab] = useState<string>("company");
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    if (!userId) return;
    setDeleting(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setDeleting(false);
      toast.error("No active session.");
      return;
    }
    const result = await deleteAccountFn({ data: { token: session.access_token } });
    if (result.error) {
      setDeleting(false);
      toast.error(result.error);
      return;
    }
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  useEffect(() => {
    if (!companyId || !userId) return;
    Promise.all([
      supabase.from("companies").select("name, logo_url").eq("id", companyId).single(),
      supabase
        .from("workspaces")
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

  const setWs = (patch: Partial<Workspace>) => update({ workspace: { ...ws, ...patch } });

  const uploadLogo = async (file: File) => {
    if (!companyId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    setLogoUploading(true);
    const dataUrl = await resizeToDataUrl(file, 256);
    const { error } = await supabase
      .from("companies")
      .update({ logo_url: dataUrl })
      .eq("id", companyId);
    if (error) {
      toast.error("Failed to save logo.");
      setLogoUploading(false);
      return;
    }
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

  const save = async () => {
    if (!companyId || !userId) {
      toast.error("No active company.");
      return;
    }
    setSaving(true);
    const [{ error: coErr }, { error: wsErr }] = await Promise.all([
      supabase.from("companies").update({ name: ws.companyName }).eq("id", companyId),
      supabase.from("workspaces").upsert(
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
        { onConflict: "company_id,user_id" },
      ),
    ]);
    setSaving(false);
    if (coErr || wsErr) {
      toast.error(friendlyError(coErr ?? wsErr, "Could not save your settings. Try again."));
      return;
    }
    // Audience, goals and targets feed the growth plan, so offer to rebuild it.
    if (["audience", "goals", "targets"].includes(tab)) {
      toast.success("Settings saved.", {
        description: "Your growth plan uses these. Regenerate it to reflect the change.",
        duration: 8000,
        action: {
          label: "Regenerate plan",
          onClick: () => {
            createGrowthPlan({ companyId, userId }, ws, { regenerate: true })
              .then(() =>
                toast.success("Growth plan regenerated", {
                  action: { label: "View plan", onClick: () => navigate({ to: "/growth" }) },
                }),
              )
              .catch((e) =>
                toast.error("Could not regenerate the plan", { description: friendlyError(e) }),
              );
          },
        },
      });
    } else toast.success("Settings saved.");
  };

  const inStyle: React.CSSProperties = {
    height: 46,
    width: "100%",
    boxSizing: "border-box",
    padding: "0 14px",
    border: 0,
    borderRadius: 12,
    background: "rgba(255,255,255,0.18)",
    color: "#ffffff",
    fontSize: 15,
    fontFamily: "inherit",
  };
  const selStyle: React.CSSProperties = {
    ...inStyle,
    appearance: "none" as const,
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 14px center",
    paddingRight: 36,
  };
  const curTab = TABS.find((t) => t[0] === tab) || TABS[0];
  const initials = (ws.companyName || "?").slice(0, 2).toUpperCase();

  return (
    <div className="sx-shell">
      <AppRail active="/settings" />

      <AppHeader title="Settings" subtitle="Manage your workspace, audience and growth targets." />

      <main className="sx-main">
        <div className="sx-page">
          {/* ── Main settings card ── */}
          <div className="sx-glass st-card">
            {/* Left sidebar tabs */}
            <div className="st-tabs">
              {TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  style={{
                    height: 48,
                    boxSizing: "border-box",
                    padding: "0 14px",
                    borderRadius: 14,
                    border: 0,
                    cursor: "pointer",
                    fontSize: 15,
                    fontWeight: 600,
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    fontFamily: "inherit",
                    background: tab === id ? "#0a66c2" : "transparent",
                    color: tab === id ? "#ffffff" : "rgba(255,255,255,0.92)",
                    boxShadow: tab === id ? "0 8px 20px rgba(6,42,92,0.3)" : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Right content area */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              {/* Tab heading */}
              <div
                className="st-pad"
                style={{ flexShrink: 0, boxSizing: "border-box", padding: "26px 36px 18px" }}
              >
                <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>
                  {curTab[1]}
                </div>
                <div style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.88)" }}>
                  {curTab[2]}
                </div>
              </div>

              {/* Scrollable body */}
              <div
                className="st-pad"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  boxSizing: "border-box",
                  padding: "6px 36px 24px",
                }}
              >
                {/* Company tab */}
                {tab === "company" && (
                  <div>
                    {/* Logo row */}
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}
                    >
                      <div
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: "50%",
                          background: "#ffffff",
                          color: "#0a66c2",
                          fontSize: 28,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          overflow: "hidden",
                        }}
                      >
                        {ws.companyLogoUrl ? (
                          <img
                            src={ws.companyLogoUrl}
                            alt="Logo"
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        ) : (
                          initials.slice(0, 1)
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>Company logo</div>
                        <div
                          style={{ marginTop: 3, fontSize: 13, color: "rgba(255,255,255,0.88)" }}
                        >
                          Shown on the workspace selector and companies page. Any image,
                          auto-resized.
                        </div>
                        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            disabled={logoUploading}
                            onClick={() => logoInputRef.current?.click()}
                            style={{
                              height: 36,
                              padding: "0 14px",
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,0.4)",
                              background: "rgba(255,255,255,0.16)",
                              color: "#ffffff",
                              fontSize: 13.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            {ws.companyLogoUrl ? "Change" : "Upload"}
                          </button>
                          {ws.companyLogoUrl && (
                            <button
                              type="button"
                              onClick={removeLogo}
                              style={{
                                height: 36,
                                padding: "0 14px",
                                borderRadius: 10,
                                border: 0,
                                background: "transparent",
                                color: "rgba(255,255,255,0.9)",
                                fontSize: 13.5,
                                cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadLogo(f);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{ margin: "22px 0", height: 1, background: "rgba(255,255,255,0.25)" }}
                    />

                    <div className="st-grid-2">
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
                          Company name
                        </div>
                        <input
                          style={inStyle}
                          type="text"
                          aria-label="Company name"
                          value={ws.companyName}
                          onChange={(e) => setWs({ companyName: e.target.value })}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
                          Industry
                        </div>
                        <input
                          style={inStyle}
                          type="text"
                          aria-label="Industry"
                          value={ws.industry}
                          onChange={(e) => setWs({ industry: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 22 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
                        Primary platform
                      </div>
                      <div className="st-grid-4">
                        {[
                          { n: "LinkedIn", active: true },
                          { n: "Instagram", active: false },
                          { n: "TikTok", active: false },
                          { n: "YouTube", active: false },
                        ].map((p) => (
                          <div
                            key={p.n}
                            style={{
                              height: 64,
                              borderRadius: 14,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 2,
                              ...(p.active
                                ? {
                                    background: "#0a66c2",
                                    boxShadow: "0 8px 20px rgba(6,42,92,0.3)",
                                    fontSize: 15,
                                    fontWeight: 600,
                                  }
                                : {
                                    border: "1px solid rgba(255,255,255,0.34)",
                                    background: "rgba(255,255,255,0.1)",
                                    color: "rgba(255,255,255,0.85)",
                                  }),
                            }}
                          >
                            <span style={{ fontSize: 15, fontWeight: 600 }}>{p.n}</span>
                            {!p.active && <span style={{ fontSize: 11.5 }}>Coming soon</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Audience tab */}
                {tab === "audience" && (
                  <div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
                        Job titles
                      </div>
                      <input
                        style={inStyle}
                        type="text"
                        value={ws.audience.jobTitles}
                        onChange={(e) =>
                          setWs({ audience: { ...ws.audience, jobTitles: e.target.value } })
                        }
                      />
                      <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                        Separate titles with commas.
                      </div>
                    </div>
                    <div className="st-grid-2" style={{ marginTop: 20 }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
                          Seniority level
                        </div>
                        <input
                          style={inStyle}
                          type="text"
                          value={ws.audience.seniority}
                          onChange={(e) =>
                            setWs({ audience: { ...ws.audience, seniority: e.target.value } })
                          }
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
                          Company size
                        </div>
                        <select
                          style={selStyle}
                          value={ws.audience.companySize}
                          onChange={(e) =>
                            setWs({ audience: { ...ws.audience, companySize: e.target.value } })
                          }
                        >
                          <option value="">Select size...</option>
                          {SIZES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
                        Audience description{" "}
                        <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.8)" }}>
                          optional
                        </span>
                      </div>
                      <textarea
                        style={{
                          ...inStyle,
                          height: 150,
                          padding: "12px 14px",
                          lineHeight: 1.5,
                          resize: "none",
                        }}
                        value={ws.audience.description}
                        onChange={(e) =>
                          setWs({ audience: { ...ws.audience, description: e.target.value } })
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Goals tab */}
                {tab === "goals" && (
                  <div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
                        Goal description
                      </div>
                      <textarea
                        style={{
                          ...inStyle,
                          height: 150,
                          padding: "12px 14px",
                          lineHeight: 1.5,
                          resize: "none",
                        }}
                        value={ws.goalDescription}
                        onChange={(e) => setWs({ goalDescription: e.target.value })}
                      />
                    </div>
                    <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>
                        Auto-fill from LinkedIn exports
                      </span>
                      <span
                        style={{
                          height: 22,
                          padding: "0 9px",
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.24)",
                          fontSize: 11.5,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        Optional
                      </span>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <LinkedInUploadSlots ws={ws} setWorkspace={(patch) => setWs(patch)} />
                    </div>
                    <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                      Files are parsed in your browser. Nothing is uploaded or stored. You can still
                      edit the numbers by hand.
                    </div>
                  </div>
                )}

                {/* Targets tab */}
                {tab === "targets" && (
                  <div>
                    {/* Header row */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.3fr 1fr 1fr",
                        gap: 16,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.85)",
                        paddingBottom: 8,
                      }}
                    >
                      <span>Metric</span>
                      <span>Baseline</span>
                      <span>Target</span>
                    </div>
                    {[
                      { key: "followers", label: "Followers", hint: "" },
                      {
                        key: "followerGrowth",
                        label: "Follower growth",
                        hint: "Average new followers per week. Auto-filled from your Followers export.",
                      },
                      {
                        key: "weeklyImpressions",
                        label: "Weekly impressions",
                        hint: "Company page, Analytics, Content. Take the total over a date range and divide by the weeks.",
                      },
                      { key: "engagementRate", label: "Engagement rate (%)", hint: "" },
                      { key: "monthlyVisitors", label: "Monthly profile visitors", hint: "" },
                      {
                        key: "weeklyPageSearches",
                        label: "Weekly page searches",
                        hint: "Company page, Analytics, Overview, Search appearances.",
                      },
                    ].map((m) => (
                      <div
                        key={m.key}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.3fr 1fr 1fr",
                          gap: 16,
                          alignItems: "start",
                          padding: "10px 0",
                          borderTop: "1px solid rgba(255,255,255,0.2)",
                        }}
                      >
                        <div style={{ paddingTop: 12 }}>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{m.label}</div>
                          {m.hint && (
                            <div
                              style={{
                                marginTop: 3,
                                fontSize: 12.5,
                                lineHeight: 1.4,
                                color: "rgba(255,255,255,0.82)",
                              }}
                            >
                              {m.hint}
                            </div>
                          )}
                        </div>
                        <input
                          style={inStyle}
                          type="number"
                          value={ws.baseline[m.key as keyof Workspace["baseline"]]}
                          onChange={(e) =>
                            setWs({ baseline: { ...ws.baseline, [m.key]: e.target.value } })
                          }
                        />
                        <input
                          style={inStyle}
                          type="number"
                          value={ws.targets[m.key as keyof Workspace["targets"]]}
                          onChange={(e) =>
                            setWs({ targets: { ...ws.targets, [m.key]: e.target.value } })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Account tab */}
                {tab === "account" && (
                  <div>
                    <div
                      style={{
                        boxSizing: "border-box",
                        padding: 22,
                        borderRadius: 18,
                        border: "1px solid rgba(255,153,142,0.7)",
                        background: "rgba(217,45,32,0.14)",
                      }}
                    >
                      <div style={{ fontSize: 17, fontWeight: 600 }}>Delete account</div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 14,
                          lineHeight: 1.5,
                          color: "rgba(255,255,255,0.92)",
                          maxWidth: 520,
                        }}
                      >
                        Permanently delete your account and all associated data. This cannot be
                        undone.
                      </div>
                      <DemoLock>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)}
                          style={{
                            marginTop: 16,
                            height: 44,
                            padding: "0 20px",
                            borderRadius: 12,
                            border: 0,
                            background: "#d92d20",
                            color: "#ffffff",
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Delete account
                        </button>
                      </DemoLock>
                    </div>
                  </div>
                )}
              </div>

              {/* Save footer (hidden on account tab) */}
              {tab !== "account" && (
                <div
                  className="st-pad"
                  style={{
                    flexShrink: 0,
                    boxSizing: "border-box",
                    padding: "16px 36px",
                    flexWrap: "wrap",
                    borderTop: "1px solid rgba(255,255,255,0.3)",
                    background: "rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 12,
                  }}
                >
                  <button
                    type="button"
                    disabled={saving}
                    style={{
                      height: 44,
                      padding: "0 18px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.4)",
                      background: "rgba(255,255,255,0.16)",
                      color: "#ffffff",
                      fontSize: 15,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Discard changes
                  </button>
                  <DemoLock>
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving}
                      style={{
                        height: 44,
                        padding: "0 18px",
                        borderRadius: 12,
                        border: 0,
                        background: "#ffffff",
                        color: "#0a66c2",
                        fontSize: 15,
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        boxShadow: "0 10px 24px rgba(6,42,92,0.22)",
                        fontFamily: "inherit",
                      }}
                    >
                      {saving ? "Saving..." : "Save settings"}
                    </button>
                  </DemoLock>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Delete account dialog */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(o) => !deleting && setShowDeleteConfirm(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account, all companies, workspaces, and content
              data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAccount}
              disabled={deleting}
              style={{ background: "#dc2626", color: "white" }}
            >
              {deleting ? "Deleting..." : "Yes, delete my account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
