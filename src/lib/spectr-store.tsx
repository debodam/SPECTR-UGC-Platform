import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import supabase from "./supabase";
import type { Session } from "@supabase/supabase-js";

const KEY = "spectr-state-v1";

export type Format = "Article" | "Post" | "Video Script" | "Carousel";

export interface User { id: string; name: string; email: string; }

export interface Workspace {
  companyId?: string;
  companyName: string;
  industry: string;
  primaryPlatform: "LinkedIn";
  startingFromScratch: boolean;
  baseline: {
    followers: string; weeklyImpressions: string; engagementRate: string;
    monthlyVisitors: string; weeklyPageSearches: string;
  };
  targets: {
    followers: string; weeklyImpressions: string; engagementRate: string;
    monthlyVisitors: string; weeklyPageSearches: string;
  };
  goalDescription: string;
  audience: {
    jobTitles: string; seniority: string; companySize: string; description: string;
  };
}

export interface PerfEntry {
  id: string; date: string; title: string; format: Format;
  source: "Transcript" | "Notes" | "Draft";
  impressions: number; engagementRate: number; followersGained: number; notes: string;
}

export interface QueueItem {
  id: string; title: string; format: Format; date: string; time: string;
  status: "Scheduled" | "Published";
}

export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  setupComplete: boolean;
  setupStep: number;
  workspace: Workspace;
  entries: PerfEntry[];
  queue: QueueItem[];
}

const emptyWorkspace: Workspace = {
  companyId: undefined,
  companyName: "", industry: "", primaryPlatform: "LinkedIn", startingFromScratch: false,
  baseline: { followers: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" },
  targets: { followers: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" },
  goalDescription: "",
  audience: { jobTitles: "", seniority: "", companySize: "", description: "" },
};

const initialState: AppState = {
  user: null, isAuthenticated: false, authLoading: true,
  setupComplete: false, setupStep: 1,
  workspace: emptyWorkspace, entries: [], queue: [],
};

const Ctx = createContext<{
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  setWorkspace: (patch: Partial<Workspace>) => void;
} | null>(null);

type StoredState = Pick<AppState, "workspace" | "setupComplete" | "setupStep" | "entries" | "queue">;

function load(): StoredState {
  const fallback: StoredState = {
    workspace: emptyWorkspace, setupComplete: false, setupStep: 1, entries: [], queue: [],
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    return {
      workspace: p.workspace || emptyWorkspace,
      setupComplete: p.setupComplete ?? false,
      setupStep: p.setupStep ?? 1,
      entries: p.entries || [],
      queue: p.queue || [],
    };
  } catch { return fallback; }
}

function sessionToUser(session: Session | null): User | null {
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "",
    email: session.user.email || "",
  };
}

export function SpectrProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = load();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        ...initialState,
        ...stored,
        user: sessionToUser(session),
        isAuthenticated: !!session,
        authLoading: false,
      });
      setHydrated(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setState((s) => ({
        ...s,
        user: sessionToUser(session),
        isAuthenticated: !!session,
        authLoading: false,
        ...(event === "SIGNED_OUT"
          ? { workspace: emptyWorkspace, setupComplete: false, setupStep: 1 }
          : {}),
      }));
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const { workspace, setupComplete, setupStep, entries, queue } = state;
    localStorage.setItem(KEY, JSON.stringify({ workspace, setupComplete, setupStep, entries, queue }));
  }, [state, hydrated]);

  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }));
  const setWorkspace = (patch: Partial<Workspace>) =>
    setState((s) => ({ ...s, workspace: { ...s.workspace, ...patch } }));

  return <Ctx.Provider value={{ state, update, setWorkspace }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}
