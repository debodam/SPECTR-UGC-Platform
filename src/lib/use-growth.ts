import { useCallback, useEffect, useState } from "react";
import { errMessage } from "@/lib/utils";
import supabase from "./supabase";
import type { Format, PerfEntry } from "./spectr-store";
import type { Experiment, GrowthPlan, Insight, Play } from "./growth-types";
import {
  getPlay,
  loadActivePlan,
  loadAllPlays,
  loadCurrentPlays,
  loadExperiments,
  loadInsights,
  type RepoCtx,
} from "./growth-repo";

export function perfFromRow(row: Record<string, unknown>): PerfEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    title: row.title as string,
    format: row.format as Format,
    source: row.source as PerfEntry["source"],
    impressions: Number(row.impressions ?? 0),
    engagementRate: Number(row.engagement_rate ?? 0),
    followersGained: Number(row.followers_gained ?? 0),
    notes: (row.notes as string) || "",
    playId: (row.play_id as string) ?? null,
    variant: (row.variant as "a" | "b") ?? null,
  };
}

export interface GrowthData {
  plan: GrowthPlan | null;
  plays: Play[];
  allPlays: Play[];
  experiments: Experiment[];
  insights: Insight[];
  entries: PerfEntry[];
}

const EMPTY: GrowthData = {
  plan: null,
  plays: [],
  allPlays: [],
  experiments: [],
  insights: [],
  entries: [],
};

/** Loads everything the growth views need for the active company. */
export function useGrowth(ctx: RepoCtx | null) {
  const [data, setData] = useState<GrowthData>(EMPTY);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const key = ctx ? `${ctx.companyId}:${ctx.userId}` : "";

  const reload = useCallback(async () => {
    if (!ctx) {
      setStatus("ready");
      return;
    }
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const [plan, plays, allPlays, experiments, insights, perf] = await Promise.all([
        loadActivePlan(ctx),
        loadCurrentPlays(ctx),
        loadAllPlays(ctx),
        loadExperiments(ctx),
        loadInsights(ctx),
        supabase
          .from("perf_entries")
          .select("*")
          .eq("company_id", ctx.companyId)
          .order("date", { ascending: false }),
      ]);
      setData({
        plan,
        plays,
        allPlays,
        experiments,
        insights,
        entries: (perf.data ?? []).map(perfFromRow),
      });
      setStatus("ready");
      setError("");
    } catch (e) {
      setError(errMessage(e) ?? "Could not load your growth plan");
      setStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    reload();
  }, [reload]);
  return { ...data, status, error, reload, setData };
}

/** Loads a single play by id (from a `?play=` search param) and keeps it fresh after status changes. */
export function usePlay(ctx: RepoCtx | null, playId: string | undefined) {
  const [play, setPlay] = useState<Play | null>(null);
  const refresh = useCallback(async () => {
    if (!ctx || !playId) {
      setPlay(null);
      return;
    }
    try {
      setPlay(await getPlay(ctx, playId));
    } catch {
      setPlay(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.companyId, ctx?.userId, playId]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { play, refresh };
}

/** Search param validator shared by every route that can be opened from a play. */
export const playSearch = (s: Record<string, unknown>): { play?: string } =>
  typeof s.play === "string" && s.play ? { play: s.play } : {};
