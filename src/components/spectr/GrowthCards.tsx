import type { ReactNode } from "react";
import { ArrowRight, FlaskConical, Lightbulb, TriangleAlert, TrendingUp } from "lucide-react";
import type { Experiment, Insight, Play, PlayStatus } from "@/lib/growth-types";

export const STATUS_LABEL: Record<PlayStatus, string> = {
  suggested: "Suggested", "in progress": "In progress", recorded: "Recorded", transformed: "Transformed",
  scheduled: "Scheduled", posted: "Posted", measured: "Measured",
};
const FORMAT_LABEL = { article: "Article", post: "Post", "video script": "Video script" } as const;

export function StatusChip({ status }: { status: PlayStatus }) {
  const tone = status === "measured" || status === "posted" ? "done" : status === "suggested" ? "neutral" : "active";
  return <span className={`gh-chip gh-chip--${tone}`}>{STATUS_LABEL[status]}</span>;
}

export function FormatChip({ format }: { format: Play["format"] }) {
  return <span className="gh-chip gh-chip--format">{FORMAT_LABEL[format]}</span>;
}

/** The next step in the loop for a play, as a button label and destination. */
export function nextStep(p: Play): { label: string; to: "/record" | "/transform" | "/distribute" | "/results" } {
  switch (p.status) {
    case "suggested": return { label: "Start play", to: "/record" };
    case "in progress": return { label: "Continue recording", to: "/record" };
    case "recorded": return { label: "Transform it", to: "/transform" };
    case "transformed": return { label: "Schedule it", to: "/distribute" };
    case "scheduled":
    case "posted": return { label: "Log results", to: "/results" };
    default: return { label: "View results", to: "/results" };
  }
}

export function PlayCard({ play, experiment, onStep, onExperiment }: {
  play: Play; experiment?: Experiment; onStep: (p: Play) => void; onExperiment?: (p: Play) => void;
}) {
  const step = nextStep(play);
  const r = play.results;
  return (
    <article className="sx-glass gh-play">
      <div className="gh-play-top">
        <span className="gh-eyebrow">{play.type}</span>
        <StatusChip status={play.status} />
      </div>
      <h3 className="gh-play-title">{play.title}</h3>
      <p className="gh-play-hook">"{play.hook}"</p>
      <p className="gh-play-why">{play.rationale}</p>
      {play.status === "measured" && r.entries ? (
        <div className="gh-play-results">
          <span><strong>{(r.impressions ?? 0).toLocaleString()}</strong> impressions</span>
          <span><strong>{r.engagementRate ?? 0}%</strong> engagement</span>
          <span><strong>+{r.followersGained ?? 0}</strong> followers</span>
        </div>
      ) : null}
      <div className="gh-play-meta">
        <FormatChip format={play.format} />
        {play.pillar && <span className="gh-pillar">{play.pillar}</span>}
        {experiment && <span className="gh-chip gh-chip--active"><FlaskConical size={12} aria-hidden="true" /> A/B test</span>}
      </div>
      <div className="gh-play-actions">
        <button type="button" className="gh-btn gh-btn--primary" onClick={() => onStep(play)}>
          {step.label}<ArrowRight size={16} aria-hidden="true" />
        </button>
        {onExperiment && !experiment && play.status !== "measured" && (
          <button type="button" className="gh-btn gh-btn--ghost" onClick={() => onExperiment(play)}>
            <FlaskConical size={15} aria-hidden="true" />Run as experiment
          </button>
        )}
      </div>
    </article>
  );
}

const INSIGHT_ICON = { pattern: TrendingUp, recommendation: Lightbulb, warning: TriangleAlert } as const;

export function InsightRow({ insight, onApply, applying }: { insight: Insight; onApply?: (i: Insight) => void; applying?: boolean }) {
  const Icon = INSIGHT_ICON[insight.kind];
  const canApply = insight.kind === "recommendation" && !!insight.evidence.action && !insight.applied && onApply;
  return (
    <div className={`gh-insight gh-insight--${insight.kind}`}>
      <span className="gh-insight-icon"><Icon size={16} aria-hidden="true" /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="gh-insight-text">{insight.text}</div>
        {insight.applied && <div className="gh-insight-note">Applied to your plan</div>}
      </div>
      {canApply && (
        <button type="button" className="gh-btn gh-btn--small" disabled={applying} onClick={() => onApply!(insight)}>
          {applying ? "Applying" : "Apply"}
        </button>
      )}
    </div>
  );
}

export function ExperimentSummary({ experiment, play }: { experiment: Experiment; play?: Play }) {
  const a = experiment.result.a, b = experiment.result.b;
  const metric = experiment.metric === "engagementRate" ? "engagement" : experiment.metric === "followersGained" ? "followers gained" : "impressions";
  return (
    <div className="gh-exp">
      {play && <div className="gh-eyebrow">{play.title}</div>}
      <div className="gh-exp-variants">
        {(["a", "b"] as const).map((k) => {
          const v = k === "a" ? a : b;
          const won = experiment.winner === k;
          return (
            <div key={k} className={`gh-exp-variant${won ? " is-winner" : ""}`}>
              <div className="gh-exp-label">Hook {k.toUpperCase()}{won ? " wins" : ""}</div>
              <div className="gh-exp-hook">"{k === "a" ? experiment.variantA : experiment.variantB}"</div>
              <div className="gh-exp-value">{v ? `${experiment.metric === "engagementRate" ? `${v.value}%` : v.value.toLocaleString()} ${metric}` : "No results yet"}</div>
            </div>
          );
        })}
      </div>
      {experiment.learning && <div className="gh-exp-learning">{experiment.learning}</div>}
    </div>
  );
}

/** Shown on Record, Transform, Distribute and Results when the page was opened from a play. */
export function PlayBanner({ play, prompts, note, onClear, action }: { play: Play; prompts?: string[]; note?: string; onClear?: () => void; action?: ReactNode }) {
  return (
    <section className="gh-banner" aria-label={`Play: ${play.title}`}>
      <div className="gh-banner-head">
        <span className="gh-eyebrow">This week's play · {play.type}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FormatChip format={play.format} />
          <StatusChip status={play.status} />
          {onClear && <button type="button" className="gh-banner-clear" onClick={onClear} aria-label="Stop working on this play">Clear</button>}
        </div>
      </div>
      <div className="gh-banner-title">{play.title}</div>
      <div className="gh-banner-hook">"{play.hook}"</div>
      {note && <div className="gh-banner-note">{note}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
      {prompts && prompts.length > 0 && (
        <ol className="gh-banner-prompts">
          {prompts.map((p) => <li key={p}>{p}</li>)}
        </ol>
      )}
    </section>
  );
}
