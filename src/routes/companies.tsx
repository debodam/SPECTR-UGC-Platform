import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import supabase from "@/lib/supabase";
import { emptyGrowthPrefs, useApp } from "@/lib/spectr-store";
import { Building2, Trash2, Plus, LogOut, LoaderCircle } from "lucide-react";
import { friendlyError } from "@/lib/utils";
import { useEscape } from "@/lib/use-escape";
import { DEMO_TIP, exitDemo, isDemo } from "@/demo/mode";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  logo_url?: string | null;
  created_by?: string;
}

export const Route = createFileRoute("/companies")({ component: CompaniesPage });

function SpectrMark({ size = 36 }: { size?: number }) {
  const r = Math.round(size * 0.278);
  const s = size * 0.556;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg aria-hidden="true" width={s} height={s} viewBox="0 0 24 24">
        <polygon points="12,3 21,21 12,21" fill="#0a66c2" />
        <polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55" />
      </svg>
    </div>
  );
}

function SkeletonCircle() {
  return (
    <div
      style={{
        width: 176,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 150,
          height: 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="spectr-skeleton" style={{ width: 112, height: 112, borderRadius: "50%" }} />
      </div>
      <div className="spectr-skeleton" style={{ width: 96, height: 16, borderRadius: 8 }} />
    </div>
  );
}

function CompanyCircle({
  company,
  focused,
  entering,
  onEnter,
  onOpen,
  onTrash,
}: {
  company: Company;
  focused: boolean;
  entering: boolean;
  onEnter: () => void;
  onOpen: () => void;
  onTrash: () => void;
}) {
  const size = focused ? 136 : 112;
  return (
    <div
      style={{
        width: 176,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 150,
          height: 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          aria-label={`Open ${company.name} workspace`}
          onClick={onOpen}
          onMouseEnter={onEnter}
          onFocus={onEnter}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            padding: 0,
            overflow: "hidden",
            cursor: "pointer",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
            transition: "all 0.18s ease",
            ...(focused
              ? {
                  border: "3px solid #ffffff",
                  boxShadow: "0 0 0 8px rgba(255,255,255,0.35),0 0 60px rgba(255,255,255,0.55)",
                }
              : { border: "2px solid rgba(255,255,255,0.3)", opacity: 0.72 }),
          }}
        >
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }}
            />
          ) : (
            <Building2 size={40} strokeWidth={1.6} color="#0a66c2" aria-hidden="true" />
          )}
        </button>

        {entering && (
          <div
            className="spectr-spin"
            style={{
              position: "absolute",
              left: 4,
              top: 4,
              right: 4,
              bottom: 4,
              borderRadius: "50%",
              border: "3px solid transparent",
              borderTopColor: "#ffffff",
              pointerEvents: "none",
            }}
          />
        )}

        {focused && !entering && (
          <button
            type="button"
            aria-label={`Delete ${company.name}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isDemo()) {
                toast(DEMO_TIP);
                return;
              }
              onTrash();
            }}
            style={{
              position: "absolute",
              right: 2,
              bottom: 2,
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "2px solid #3a82dc",
              background: "#ffffff",
              color: "#0b1220",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            <Trash2 size={18} strokeWidth={1.9} aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        style={
          focused
            ? { fontSize: 18, fontWeight: 700, color: "#ffffff", textAlign: "center" }
            : {
                fontSize: 16,
                fontWeight: 500,
                color: "rgba(255,255,255,0.88)",
                textAlign: "center",
              }
        }
      >
        {company.name}
      </div>
    </div>
  );
}

function AddCircle({
  focused,
  onEnter,
  onAdd,
}: {
  focused: boolean;
  onEnter: () => void;
  onAdd: () => void;
}) {
  const size = focused ? 136 : 112;
  return (
    <div
      style={{
        width: 176,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 150,
          height: 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          aria-label="Add company"
          onClick={onAdd}
          onMouseEnter={onEnter}
          onFocus={onEnter}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
            transition: "all 0.18s ease",
            color: "#ffffff",
            ...(focused
              ? {
                  border: "2px solid #ffffff",
                  background: "rgba(255,255,255,0.22)",
                  boxShadow: "0 0 0 8px rgba(255,255,255,0.22),0 0 60px rgba(255,255,255,0.5)",
                }
              : {
                  border: "2px dashed rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.05)",
                  opacity: 0.85,
                }),
          }}
        >
          <Plus size={32} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
      <div
        style={
          focused
            ? { fontSize: 18, fontWeight: 700, color: "#ffffff", textAlign: "center" }
            : {
                fontSize: 16,
                fontWeight: 500,
                color: "rgba(255,255,255,0.88)",
                textAlign: "center",
              }
        }
      >
        Add company
      </div>
    </div>
  );
}

function CompaniesPage() {
  const { state, update, setWorkspace } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  useEscape(showNew, () => setShowNew(false));
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state.authLoading) return;
    if (!state.isAuthenticated) {
      navigate({ to: "/access" });
      return;
    }
    fetchCompanies();
  }, [state.authLoading, state.isAuthenticated]);

  async function fetchCompanies() {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("created_by", state.user!.id)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      console.error(error);
      return;
    }
    setCompanies(data || []);
  }

  async function selectCompany(c: Company) {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    setEntering(c.id);
    enterTimer.current = setTimeout(() => setEntering(null), 1400);

    const { data } = await supabase
      .from("workspaces")
      .select("*")
      .eq("company_id", c.id)
      .eq("user_id", state.user!.id)
      .maybeSingle();

    if (data?.setup_complete) {
      update({
        setupComplete: true,
        workspace: {
          growthPrefs: { ...emptyGrowthPrefs, ...(data.growth_prefs || {}) },
          companyId: c.id,
          companyName: c.name,
          industry: data.industry || "",
          primaryPlatform: "LinkedIn",
          startingFromScratch: data.starting_from_scratch ?? false,
          companyDescription: "",
          companyPdfUrl: "",
          companyPdfName: "",
          baseline: data.baseline || {
            followers: "",
            weeklyImpressions: "",
            engagementRate: "",
            monthlyVisitors: "",
            weeklyPageSearches: "",
          },
          targets: data.targets || {
            followers: "",
            weeklyImpressions: "",
            engagementRate: "",
            monthlyVisitors: "",
            weeklyPageSearches: "",
          },
          goalDescription: data.goal_description || "",
          audience: data.audience || {
            jobTitles: "",
            seniority: "",
            companySize: "",
            description: "",
          },
        },
      });
      navigate({ to: "/" });
    } else {
      setWorkspace({ companyId: c.id, companyName: c.name });
      update({ setupComplete: false, setupStep: 1 });
      navigate({ to: "/setup" });
    }
  }

  async function createCompany() {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError("");
    await supabase
      .from("profiles")
      .upsert(
        { id: state.user!.id, full_name: state.user!.name, email: state.user!.email },
        { onConflict: "id" },
      );
    const { data, error } = await supabase
      .from("companies")
      .insert([{ name: name.trim(), created_by: state.user!.id }])
      .select()
      .limit(1)
      .single();
    setCreating(false);
    if (error) {
      setCreateError(friendlyError(error, "Could not create the company. Try again."));
      return;
    }
    if (data) {
      setWorkspace({ companyId: data.id, companyName: data.name });
      update({ setupComplete: false, setupStep: 1 });
      navigate({ to: "/setup" });
    }
  }

  async function deleteCompany(id: string) {
    setDeleting(true);
    const { error } = await supabase.from("companies").delete().eq("id", id);
    setDeleting(false);
    if (error) {
      console.error(error);
      return;
    }
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    setConfirmDelete(null);
    if (state.workspace.companyId === id) {
      update({
        setupComplete: false,
        workspace: {
          growthPrefs: emptyGrowthPrefs,
          companyId: undefined,
          companyName: "",
          industry: "",
          primaryPlatform: "LinkedIn",
          startingFromScratch: false,
          companyDescription: "",
          companyPdfUrl: "",
          companyPdfName: "",
          baseline: {
            followers: "",
            followerGrowth: "",
            weeklyImpressions: "",
            engagementRate: "",
            monthlyVisitors: "",
            weeklyPageSearches: "",
          },
          targets: {
            followers: "",
            followerGrowth: "",
            weeklyImpressions: "",
            engagementRate: "",
            monthlyVisitors: "",
            weeklyPageSearches: "",
          },
          goalDescription: "",
          audience: { jobTitles: "", seniority: "", companySize: "", description: "" },
        },
      });
    }
  }

  if (state.authLoading) return <div style={{ minHeight: "100vh" }} />;

  const isEmpty = !loading && companies.length === 0;

  return (
    <div className="au-shell">
      <div
        className="co-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          padding: "32px 44px 36px",
        }}
      >
        {/* Logo top-left */}
        <Link
          to="/welcome"
          aria-label="SPECTR home"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
            alignSelf: "flex-start",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          <SpectrMark size={36} />
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.02em" }}>SPECTR</div>
        </Link>

        {/* Center content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "clamp(32px, 6vh, 64px)",
            padding: "40px 0",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 300,
                letterSpacing: "-0.02em",
              }}
            >
              Select your workspace
            </h1>
            <p style={{ margin: "12px 0 0", fontSize: 16, color: "rgba(255,255,255,0.88)" }}>
              {isEmpty
                ? "Add your first company to get started."
                : "Choose a company to enter its content workspace."}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              justifyContent: "center",
              gap: "32px 48px",
              maxWidth: 1100,
            }}
            onMouseLeave={() => setFocus(null)}
          >
            {loading ? (
              [1, 2, 3].map((i) => <SkeletonCircle key={i} />)
            ) : (
              <>
                {companies.map((c) => (
                  <CompanyCircle
                    key={c.id}
                    company={c}
                    focused={focus === c.id}
                    entering={entering === c.id}
                    onEnter={() => setFocus(c.id)}
                    onOpen={() => selectCompany(c)}
                    onTrash={() => setConfirmDelete(c)}
                  />
                ))}
                <AddCircle
                  focused={isEmpty || focus === "add"}
                  onEnter={() => setFocus("add")}
                  onAdd={() => {
                    setShowNew(true);
                    setName("");
                    setCreateError("");
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* Logout bottom-left */}
        <button
          type="button"
          onClick={async () => {
            if (isDemo()) return exitDemo();
            await supabase.auth.signOut();
            localStorage.removeItem("spectr-access-verified");
            navigate({ to: "/access" });
          }}
          style={{
            alignSelf: "flex-start",
            flexShrink: 0,
            height: 44,
            padding: "0 20px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.45)",
            background: "rgba(255,255,255,0.06)",
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
          }}
        >
          <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
          Log out
        </button>

        {/* New company modal */}
        {showNew && (
          <div
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(10,50,110,0.5)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <div
              role="dialog"
              aria-label="New company"
              style={{
                width: "100%",
                maxWidth: 420,
                boxSizing: "border-box",
                padding: 32,
                borderRadius: 28,
                background: "#f7f9fc",
                color: "#0b1220",
                boxShadow: "0 40px 100px rgba(0,0,0,0.45)",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 300, letterSpacing: "-0.01em" }}>
                New company
              </h2>
              <label
                htmlFor="cname"
                style={{ display: "block", margin: "22px 0 8px", fontSize: 13, fontWeight: 600 }}
              >
                Company name
              </label>
              <input
                id="cname"
                type="text"
                placeholder="Company name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setCreateError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && createCompany()}
                autoFocus
                style={{
                  width: "100%",
                  height: 48,
                  boxSizing: "border-box",
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "1px solid transparent",
                  background: "#eaf0f8",
                  fontSize: 15,
                  fontFamily: "inherit",
                  color: "#0b1220",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#0a66c2";
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.boxShadow = "0 0 0 4px rgba(10,102,194,0.16)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "transparent";
                  e.currentTarget.style.background = "#eaf0f8";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {createError && (
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "#b42318" }}>{createError}</p>
              )}
              <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
                <button
                  type="button"
                  onClick={createCompany}
                  disabled={creating || !name.trim()}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 12,
                    border: 0,
                    background: creating ? "rgba(10,102,194,0.85)" : "#0a66c2",
                    color: "#ffffff",
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: "0 10px 26px rgba(10,102,194,0.35)",
                    cursor: creating ? "progress" : "pointer",
                  }}
                >
                  {creating && (
                    <LoaderCircle
                      size={18}
                      strokeWidth={3}
                      color="#ffffff"
                      className="spectr-spin"
                      aria-hidden="true"
                    />
                  )}
                  {creating ? "Creating" : "Create & set up"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNew(false);
                    setName("");
                    setCreateError("");
                  }}
                  style={{
                    height: 48,
                    padding: "0 22px",
                    borderRadius: 12,
                    border: "1px solid #c3d4ec",
                    background: "#ffffff",
                    color: "#0b1220",
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {confirmDelete && (
          <div
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(10,50,110,0.5)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <div
              role="alertdialog"
              aria-label="Delete company"
              style={{
                width: 440,
                boxSizing: "border-box",
                padding: 32,
                borderRadius: 28,
                background: "#f7f9fc",
                color: "#0b1220",
                boxShadow: "0 40px 100px rgba(0,0,0,0.45)",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "#fef3f2",
                  color: "#d92d20",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={22} strokeWidth={1.9} aria-hidden="true" />
              </div>
              <h2
                style={{
                  margin: "18px 0 0",
                  fontSize: 22,
                  fontWeight: 400,
                  letterSpacing: "-0.01em",
                }}
              >
                Delete "{confirmDelete.name}"?
              </h2>
              <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.5, color: "#475569" }}>
                Are you sure you want to delete this company? All workspace details, goals, and
                tracking data will be permanently lost and cannot be recovered.
              </p>
              <div style={{ marginTop: 26, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(null)}
                  style={{
                    height: 48,
                    padding: "0 22px",
                    borderRadius: 12,
                    border: "1px solid #c3d4ec",
                    background: "#ffffff",
                    color: "#0b1220",
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => deleteCompany(confirmDelete.id)}
                  style={{
                    height: 48,
                    padding: "0 22px",
                    borderRadius: 12,
                    border: 0,
                    background: "#d92d20",
                    color: "#ffffff",
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: deleting ? "progress" : "pointer",
                    opacity: deleting ? 0.8 : 1,
                  }}
                >
                  {deleting ? "Deleting..." : "Delete company"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
