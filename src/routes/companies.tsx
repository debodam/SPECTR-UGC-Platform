import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Building2, Trash2, LogOut } from "lucide-react";
import supabase from "@/lib/supabase";
import { useApp } from "@/lib/spectr-store";

export const Route = createFileRoute("/companies")({ component: CompaniesPage });

function CompaniesPage() {
  const { state, update, setWorkspace } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (state.authLoading) return;
    if (!state.isAuthenticated) { navigate({ to: "/login" }); return; }
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
    if (error) { console.error(error); return; }
    setCompanies(data || []);
  }

  async function selectCompany(c: any) {
    setLoading(true);
    const { data } = await supabase
      .from("workspaces")
      .select("*")
      .eq("company_id", c.id)
      .eq("user_id", state.user!.id)
      .maybeSingle();
    setLoading(false);

    if (data?.setup_complete) {
      update({
        setupComplete: true,
        workspace: {
          companyId: c.id,
          companyName: c.name,
          industry: data.industry || "",
          primaryPlatform: "LinkedIn",
          startingFromScratch: data.starting_from_scratch ?? false,
          baseline: data.baseline || { followers: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" },
          targets: data.targets || { followers: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" },
          goalDescription: data.goal_description || "",
          audience: data.audience || { jobTitles: "", seniority: "", companySize: "", description: "" },
        },
      });
      navigate({ to: "/transform" });
    } else {
      // Reset setup state so the wizard starts fresh for this company
      setWorkspace({ companyId: c.id, companyName: c.name });
      update({ setupComplete: false, setupStep: 1 });
      navigate({ to: "/setup" });
    }
  }

  async function createCompany() {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError("");
    const { data, error } = await supabase
      .from("companies")
      .insert([{ name: name.trim(), created_by: state.user!.id }])
      .select()
      .limit(1)
      .single();
    setCreating(false);
    if (error) { setCreateError(error.message); return; }
    if (data) {
      // Reset setup state so the wizard starts fresh
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
        workspace: { companyId: undefined, companyName: "", industry: "", primaryPlatform: "LinkedIn", startingFromScratch: false, baseline: { followers: "", followerGrowth: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" }, targets: { followers: "", followerGrowth: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" }, goalDescription: "", audience: { jobTitles: "", seniority: "", companySize: "", description: "" } },
      });
    }
  }

  if (state.authLoading) {
    return <div className="min-h-screen" style={{ background: "var(--color-surface)" }} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: "var(--color-surface)" }}>
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold">Your companies</h1>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
            className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <LogOut size={15} /> Log out
          </button>
        </div>
        <p className="text-sm mb-8" style={{ color: "var(--color-text-secondary)" }}>
          Select a company to enter its workspace.
        </p>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[56px] rounded-lg animate-pulse" style={{ background: "var(--color-border)" }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {companies.map((c) => (
              <div key={c.id} className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--color-border)", background: "white" }}>
                {confirmDelete === c.id ? (
                  <div className="p-4">
                    <p className="text-sm font-semibold mb-1">Delete "{c.name}"?</p>
                    <p className="text-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>
                      This removes the company and all its data permanently.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteCompany(c.id)}
                        disabled={deleting}
                        className="spectr-btn-primary text-xs px-3 py-1.5"
                        style={{ background: "#dc2626" }}
                      >
                        {deleting ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button onClick={() => setConfirmDelete(null)} className="spectr-btn text-xs px-3 py-1.5">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-stretch">
                    <button
                      onClick={() => selectCompany(c)}
                      className="flex-1 flex items-center gap-3 p-4 text-left hover:bg-[var(--color-surface)] transition-colors"
                    >
                      <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                        style={{ background: "rgba(10,102,194,0.1)" }}>
                        <Building2 size={16} style={{ color: "var(--color-primary)" }} />
                      </div>
                      <span className="text-sm font-semibold truncate">{c.name}</span>
                    </button>
                    <button
                      onClick={() => setConfirmDelete(c.id)}
                      className="px-3 border-l hover:bg-red-50 transition-colors"
                      style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {!showNew && (
              <button
                onClick={() => setShowNew(true)}
                className="h-[56px] rounded-lg border-2 border-dashed flex items-center justify-center gap-2 text-sm font-medium transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
              >
                <Plus size={16} /> New company
              </button>
            )}
          </div>
        )}

        {showNew && (
          <div className="mt-4 p-5 rounded-lg border" style={{ background: "white", borderColor: "var(--color-border)" }}>
            <h3 className="text-sm font-semibold mb-3">Create new company</h3>
            <input
              className="spectr-input"
              placeholder="Company name"
              value={name}
              onChange={(e) => { setName(e.target.value); setCreateError(""); }}
              onKeyDown={(e) => e.key === "Enter" && createCompany()}
              autoFocus
            />
            {createError && <p className="text-xs mt-2" style={{ color: "#dc2626" }}>{createError}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={createCompany} disabled={creating || !name.trim()} className="spectr-btn-primary">
                {creating ? "Creating…" : "Create & set up"}
              </button>
              <button onClick={() => { setShowNew(false); setName(""); setCreateError(""); }} className="spectr-btn">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
