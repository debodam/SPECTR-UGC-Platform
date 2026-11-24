import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import supabase from "@/lib/supabase";
import { useApp } from "@/lib/spectr-store";

export const Route = createFileRoute("/companies")({ component: CompaniesPage });

function SpectrMark({ size = 36 }: { size?: number }) {
  const r = Math.round(size * 0.278);
  const s = size * 0.556;
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg aria-hidden="true" width={s} height={s} viewBox="0 0 24 24">
        <polygon points="12,3 21,21 12,21" fill="#0a66c2" />
        <polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55" />
      </svg>
    </div>
  );
}

function SkeletonCircle() {
  return (
    <div style={{ width: 176, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ width: 150, height: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spectr-skeleton" style={{ width: 112, height: 112, borderRadius: "50%" }} />
      </div>
      <div className="spectr-skeleton" style={{ width: 96, height: 16, borderRadius: 8 }} />
    </div>
  );
}

function CompanyCircle({
  company, focused, entering,
  onEnter, onOpen, onTrash,
}: {
  company: any; focused: boolean; entering: boolean;
  onEnter: () => void; onOpen: () => void; onTrash: () => void;
}) {
  const size = focused ? 136 : 112;
  return (
    <div style={{ width: 176, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ position: "relative", width: 150, height: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button
          type="button"
          aria-label={`Open ${company.name} workspace`}
          onClick={onOpen}
          onMouseEnter={onEnter}
          onFocus={onEnter}
          style={{
            width: size, height: size, borderRadius: "50%", padding: 0,
            overflow: "hidden", cursor: "pointer",
            background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center",
            boxSizing: "border-box", transition: "all 0.18s ease",
            ...(focused
              ? { border: "3px solid #ffffff", boxShadow: "0 0 0 8px rgba(255,255,255,0.35),0 0 60px rgba(255,255,255,0.55)" }
              : { border: "2px solid rgba(255,255,255,0.3)", opacity: 0.72 }),
          }}
        >
          {company.logo_url ? (
            <img src={company.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} />
          ) : (
            <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0a66c2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 21V7l8-4 8 4v14" /><path d="M9 21v-6h6v6" /><path d="M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
            </svg>
          )}
        </button>

        {entering && (
          <div className="spectr-spin" style={{
            position: "absolute", left: 4, top: 4, right: 4, bottom: 4,
            borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#ffffff",
            pointerEvents: "none",
          }} />
        )}

        {focused && !entering && (
          <button
            type="button"
            aria-label={`Delete ${company.name}`}
            onClick={(e) => { e.stopPropagation(); onTrash(); }}
            style={{
              position: "absolute", right: 2, bottom: 2, width: 44, height: 44, borderRadius: "50%",
              border: "2px solid #3a82dc", background: "#ffffff", color: "#0b1220",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
            }}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v6" /><path d="M14 11v6" />
            </svg>
          </button>
        )}
      </div>

      <div style={focused
        ? { fontSize: 18, fontWeight: 700, color: "#ffffff", textAlign: "center" }
        : { fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.88)", textAlign: "center" }
      }>
        {company.name}
      </div>
    </div>
  );
}

function AddCircle({ focused, onEnter, onAdd }: { focused: boolean; onEnter: () => void; onAdd: () => void }) {
  const size = focused ? 136 : 112;
  return (
    <div style={{ width: 176, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ width: 150, height: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button
          type="button"
          aria-label="Add company"
          onClick={onAdd}
          onMouseEnter={onEnter}
          onFocus={onEnter}
          style={{
            width: size, height: size, borderRadius: "50%", padding: 0,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxSizing: "border-box", transition: "all 0.18s ease", color: "#ffffff",
            ...(focused
              ? { border: "2px solid #ffffff", background: "rgba(255,255,255,0.22)", boxShadow: "0 0 0 8px rgba(255,255,255,0.22),0 0 60px rgba(255,255,255,0.5)" }
              : { border: "2px dashed rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)", opacity: 0.85 }),
          }}
        >
          <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
        </button>
      </div>
      <div style={focused
        ? { fontSize: 18, fontWeight: 700, color: "#ffffff", textAlign: "center" }
        : { fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.88)", textAlign: "center" }
      }>
        Add company
      </div>
    </div>
  );
}

function CompaniesPage() {
  const { state, update, setWorkspace } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state.authLoading) return;
    if (!state.isAuthenticated) { navigate({ to: "/access" }); return; }
    fetchCompanies();
  }, [state.authLoading, state.isAuthenticated]);

  async function fetchCompanies() {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies").select("*")
      .eq("created_by", state.user!.id)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) { console.error(error); return; }
    setCompanies(data || []);
  }

  async function selectCompany(c: any) {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    setEntering(c.id);
    enterTimer.current = setTimeout(() => setEntering(null), 1400);

    const { data } = await supabase
      .from("workspaces").select("*")
      .eq("company_id", c.id).eq("user_id", state.user!.id).maybeSingle();

    if (data?.setup_complete) {
      update({
        setupComplete: true,
        workspace: {
          companyId: c.id, companyName: c.name, industry: data.industry || "",
          primaryPlatform: "LinkedIn", startingFromScratch: data.starting_from_scratch ?? false,
          companyDescription: "", companyPdfUrl: "", companyPdfName: "",
          baseline: data.baseline || { followers: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" },
          targets: data.targets || { followers: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" },
          goalDescription: data.goal_description || "",
          audience: data.audience || { jobTitles: "", seniority: "", companySize: "", description: "" },
        },
      });
      navigate({ to: "/transform" });
    } else {
      setWorkspace({ companyId: c.id, companyName: c.name });
      update({ setupComplete: false, setupStep: 1 });
      navigate({ to: "/setup" });
    }
  }

  async function createCompany() {
    if (!name.trim()) return;
    setCreating(true); setCreateError("");
    await supabase.from("profiles").upsert(
      { id: state.user!.id, full_name: state.user!.name, email: state.user!.email },
      { onConflict: "id" },
    );
    const { data, error } = await supabase
      .from("companies").insert([{ name: name.trim(), created_by: state.user!.id }])
      .select().limit(1).single();
    setCreating(false);
    if (error) { setCreateError(error.message); return; }
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
    if (error) { console.error(error); return; }
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    setConfirmDelete(null);
    if (state.workspace.companyId === id) {
      update({
        setupComplete: false,
        workspace: {
          companyId: undefined, companyName: "", industry: "", primaryPlatform: "LinkedIn",
          startingFromScratch: false, companyDescription: "", companyPdfUrl: "", companyPdfName: "",
          baseline: { followers: "", followerGrowth: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" },
          targets: { followers: "", followerGrowth: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" },
          goalDescription: "", audience: { jobTitles: "", seniority: "", companySize: "", description: "" },
        },
      });
    }
  }

  if (state.authLoading) return <div style={{ minHeight: "100vh" }} />;

  const isEmpty = !loading && companies.length === 0;

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Shell */}
      <div style={{
        position: "relative", width: 1240, height: 760, borderRadius: 44, overflow: "hidden",
        background: "radial-gradient(700px 520px at 30% 45%,rgba(160,205,255,0.45),rgba(160,205,255,0) 70%),linear-gradient(150deg,#5b9be4 0%,#3a82dc 42%,#1a56a8 100%)",
        boxShadow: "0 0 0 6px rgba(255,255,255,0.92),0 50px 120px rgba(3,30,70,0.38)",
        color: "#ffffff",
      }}>

        {/* Logo top-left */}
        <div style={{ position: "absolute", left: 44, top: 36, display: "flex", alignItems: "center", gap: 10 }}>
          <SpectrMark size={36} />
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.02em" }}>SPECTR</div>
        </div>

        {/* Center content */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 64 }}>

          <div style={{ textAlign: "center" }}>
            <h1 style={{ margin: 0, fontSize: 40, fontWeight: 300, letterSpacing: "-0.02em" }}>Select your workspace</h1>
            <p style={{ margin: "12px 0 0", fontSize: 16, color: "rgba(255,255,255,0.88)" }}>
              {isEmpty ? "Add your first company to get started." : "Choose a company to enter its content workspace."}
            </p>
          </div>

          <div
            style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 48 }}
            onMouseLeave={() => setFocus(null)}
          >
            {loading ? (
              [1, 2, 3].map((i) => <SkeletonCircle key={i} />)
            ) : (
              <>
                {companies.map((c) => (
                  <CompanyCircle
                    key={c.id} company={c}
                    focused={focus === c.id} entering={entering === c.id}
                    onEnter={() => setFocus(c.id)}
                    onOpen={() => selectCompany(c)}
                    onTrash={() => setConfirmDelete(c)}
                  />
                ))}
                <AddCircle
                  focused={isEmpty || focus === "add"}
                  onEnter={() => setFocus("add")}
                  onAdd={() => { setShowNew(true); setName(""); setCreateError(""); }}
                />
              </>
            )}
          </div>
        </div>

        {/* Logout bottom-left */}
        <button
          type="button"
          onClick={async () => { await supabase.auth.signOut(); localStorage.removeItem("spectr-access-verified"); navigate({ to: "/access" }); }}
          style={{
            position: "absolute", left: 44, bottom: 40, height: 44, padding: "0 20px",
            borderRadius: 999, border: "1px solid rgba(255,255,255,0.45)",
            background: "rgba(255,255,255,0.06)", color: "#ffffff",
            fontSize: 14, fontWeight: 600, fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
          }}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" /><path d="M16 8l4 4-4 4" /><path d="M20 12H9" />
          </svg>
          Log out
        </button>

        {/* New company modal */}
        {showNew && (
          <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,50,110,0.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
            <div role="dialog" aria-label="New company" style={{ width: 420, boxSizing: "border-box", padding: 32, borderRadius: 28, background: "#f7f9fc", color: "#0b1220", boxShadow: "0 40px 100px rgba(0,0,0,0.45)" }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 300, letterSpacing: "-0.01em" }}>New company</h2>
              <label htmlFor="cname" style={{ display: "block", margin: "22px 0 8px", fontSize: 13, fontWeight: 600 }}>Company name</label>
              <input
                id="cname" type="text" placeholder="Company name" value={name}
                onChange={(e) => { setName(e.target.value); setCreateError(""); }}
                onKeyDown={(e) => e.key === "Enter" && createCompany()}
                autoFocus
                style={{
                  width: "100%", height: 48, boxSizing: "border-box", padding: "0 16px",
                  borderRadius: 12, border: "1px solid transparent", background: "#eaf0f8",
                  fontSize: 15, fontFamily: "inherit", color: "#0b1220", outline: "none",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0a66c2"; e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.boxShadow = "0 0 0 4px rgba(10,102,194,0.16)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "#eaf0f8"; e.currentTarget.style.boxShadow = "none"; }}
              />
              {createError && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#b42318" }}>{createError}</p>}
              <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
                <button
                  type="button" onClick={createCompany} disabled={creating || !name.trim()}
                  style={{
                    flex: 1, height: 48, borderRadius: 12, border: 0,
                    background: creating ? "rgba(10,102,194,0.85)" : "#0a66c2",
                    color: "#ffffff", fontSize: 15, fontWeight: 600, fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    boxShadow: "0 10px 26px rgba(10,102,194,0.35)",
                    cursor: creating ? "progress" : "pointer",
                  }}
                >
                  {creating && (
                    <svg className="spectr-spin" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round">
                      <path d="M12 3a9 9 0 1 0 9 9" />
                    </svg>
                  )}
                  {creating ? "Creating" : "Create & set up"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNew(false); setName(""); setCreateError(""); }}
                  style={{ height: 48, padding: "0 22px", borderRadius: 12, border: "1px solid #c3d4ec", background: "#ffffff", color: "#0b1220", fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {confirmDelete && (
          <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,50,110,0.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
            <div role="alertdialog" aria-label="Delete company" style={{ width: 440, boxSizing: "border-box", padding: 32, borderRadius: 28, background: "#f7f9fc", color: "#0b1220", boxShadow: "0 40px 100px rgba(0,0,0,0.45)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fef3f2", color: "#d92d20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v6" /><path d="M14 11v6" />
                </svg>
              </div>
              <h2 style={{ margin: "18px 0 0", fontSize: 22, fontWeight: 400, letterSpacing: "-0.01em" }}>Delete "{confirmDelete.name}"?</h2>
              <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.5, color: "#475569" }}>
                Are you sure you want to delete this company? All workspace details, goals, and tracking data will be permanently lost and cannot be recovered.
              </p>
              <div style={{ marginTop: 26, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  type="button" disabled={deleting}
                  onClick={() => setConfirmDelete(null)}
                  style={{ height: 48, padding: "0 22px", borderRadius: 12, border: "1px solid #c3d4ec", background: "#ffffff", color: "#0b1220", fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button" disabled={deleting}
                  onClick={() => deleteCompany(confirmDelete.id)}
                  style={{ height: 48, padding: "0 22px", borderRadius: 12, border: 0, background: "#d92d20", color: "#ffffff", fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: deleting ? "progress" : "pointer", opacity: deleting ? 0.8 : 1 }}
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
