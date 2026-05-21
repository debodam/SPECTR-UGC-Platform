import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const KEY = "spectr-state-v1";

export type Format = "Article" | "Post" | "Video Script" | "Carousel";

export interface User { name: string; email: string; password: string; }

export interface Workspace {
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
  users: User[];
  isAuthenticated: boolean;
  setupComplete: boolean;
  setupStep: number;
  workspace: Workspace;
  entries: PerfEntry[];
  queue: QueueItem[];
}

const emptyWorkspace: Workspace = {
  companyName: "", industry: "", primaryPlatform: "LinkedIn", startingFromScratch: false,
  baseline: { followers: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" },
  targets: { followers: "", weeklyImpressions: "", engagementRate: "", monthlyVisitors: "", weeklyPageSearches: "" },
  goalDescription: "",
  audience: { jobTitles: "", seniority: "", companySize: "", description: "" },
};

const initialState: AppState = {
  user: null, users: [], isAuthenticated: false,
  setupComplete: false, setupStep: 1,
  workspace: emptyWorkspace, entries: [], queue: [],
};

const Ctx = createContext<{
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  setWorkspace: (patch: Partial<Workspace>) => void;
} | null>(null);

function load(): AppState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState;
    return { ...initialState, ...JSON.parse(raw) };
  } catch { return initialState; }
}

export function SpectrProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setState(load()); setHydrated(true); }, []);
  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(state));
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
