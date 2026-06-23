import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Building2, Trash2, LogOut } from "lucide-react";
import supabase from "@/lib/supabase";
import { useApp } from "@/lib/spectr-store";
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
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
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
      setWorkspace({ companyId: c.id, companyName: c.name });
      update({ setupComplete: false, setupStep: 1 });
      navigate({ to: "/setup" });
    }
  }

  async function createCompany() {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError("");

    // Ensure a profile row exists — companies.created_by is a FK to public.profiles
    await supabase.from("profiles").upsert(
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
          startingFromScratch: false,
          baseline: { followers: "", followerGrowth: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" },
          targets: { followers: "", followerGrowth: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" },
          goalDescription: "",
          audience: { jobTitles: "", seniority: "", companySize: "", description: "" },
        },
      });
    }
  }

  if (state.authLoading) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold tracking-tight">Select your workspace</h1>
        <p className="text-sm mt-2" style={{ color: "var(--color-text-secondary)" }}>
          Choose a company to enter its content workspace.
        </p>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex gap-5">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="w-[172px] h-[256px] rounded-2xl animate-pulse"
              style={{ background: "var(--color-border)" }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap justify-center items-center gap-5">
          {companies.map((c) => (
            <div
              key={c.id}
              onClick={() => selectCompany(c)}
              className="group relative w-[172px] flex flex-col rounded-2xl overflow-hidden cursor-pointer select-none transition-all duration-150 hover:-translate-y-0.5"
              style={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
              }}
            >
              {/* Cover / logo zone */}
              <div
                className="w-full h-[140px] flex items-center justify-center shrink-0"
                style={{ background: "var(--color-card-2)", borderBottom: "1px solid var(--color-border)" }}
              >
                {c.logo_url ? (
                  <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={36} style={{ color: "var(--color-primary)" }} />
                )}
              </div>

              {/* Name + actions */}
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-3 py-5">
                <span className="text-sm font-bold text-center leading-snug line-clamp-2 w-full text-white">
                  {c.name}
                </span>

                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(c); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-[rgba(220,38,38,0.15)]"
                  style={{ color: "var(--color-text-secondary)" }}
                  title="Delete company"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {/* Add new */}
          <button
            onClick={() => setShowNew(true)}
            className="w-[60px] h-[60px] rounded-full flex items-center justify-center transition-all hover:scale-105"
            style={{
              background: "var(--color-card)",
              border: "2px solid var(--color-border)",
              color: "var(--color-text-secondary)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
            title="Add company"
          >
            <Plus size={22} />
          </button>
        </div>
      )}

      {/* Create form */}
      {showNew && (
        <div
          className="mt-8 w-full max-w-sm p-6 rounded-2xl"
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.45)" }}
        >
          <h3 className="text-sm font-bold mb-4">New company</h3>
          <input
            className="spectr-input"
            placeholder="Company name"
            value={name}
            onChange={(e) => { setName(e.target.value); setCreateError(""); }}
            onKeyDown={(e) => e.key === "Enter" && createCompany()}
            autoFocus
          />
          {createError && <p className="text-xs mt-2" style={{ color: "#f87171" }}>{createError}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={createCompany} disabled={creating || !name.trim()} className="spectr-btn-primary flex-1">
              {creating ? "Creating..." : "Create & set up"}
            </button>
            <button
              onClick={() => { setShowNew(false); setName(""); setCreateError(""); }}
              className="spectr-btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Logout */}
      <button
        onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
        className="mt-12 flex items-center gap-2 text-sm transition-opacity hover:opacity-60"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <LogOut size={14} /> Log out
      </button>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this company? All workspace details, goals, and tracking data will be permanently lost and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteCompany(confirmDelete.id)}
              disabled={deleting}
              className="hover:opacity-90"
              style={{ background: "#dc2626", color: "white" }}
            >
              {deleting ? "Deleting..." : "Delete company"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
