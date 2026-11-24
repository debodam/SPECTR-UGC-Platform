import { useEffect, useRef, useState } from "react";
import { errMessage } from "@/lib/utils";
import { X } from "lucide-react";
import type { ExperimentMetric, Play } from "@/lib/growth-types";

const METRICS: { value: ExperimentMetric; label: string }[] = [
  { value: "impressions", label: "Impressions" },
  { value: "engagementRate", label: "Engagement rate" },
  { value: "followersGained", label: "Followers gained" },
];

/** Two hooks for one play. Results logged against each hook are compared on the Results page. */
export function ExperimentDialog({
  play,
  onCancel,
  onCreate,
}: {
  play: Play;
  onCancel: () => void;
  onCreate: (e: {
    variantA: string;
    variantB: string;
    hypothesis: string;
    metric: ExperimentMetric;
  }) => Promise<void>;
}) {
  const [a, setA] = useState(play.hook);
  const [b, setB] = useState("");
  const [metric, setMetric] = useState<ExperimentMetric>("impressions");
  const [hypothesis, setHypothesis] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const bRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const metricLabel = METRICS.find((m) => m.value === metric)!.label.toLowerCase();
  const submit = async () => {
    if (!a.trim() || !b.trim()) {
      setErr("Write both hooks to compare.");
      return;
    }
    if (a.trim() === b.trim()) {
      setErr("The two hooks need to be different.");
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        variantA: a.trim(),
        variantB: b.trim(),
        metric,
        hypothesis: hypothesis.trim() || `Hook B earns more ${metricLabel} than hook A.`,
      });
    } catch (e) {
      setErr(errMessage(e) ?? "Could not start the experiment");
      setSaving(false);
    }
  };

  return (
    <div
      className="gx-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="gx-dialog" role="dialog" aria-modal="true" aria-labelledby="gx-title">
        <div className="gx-head">
          <div>
            <div className="gh-eyebrow">Run as experiment</div>
            <h2 id="gx-title" className="gh-h2">
              {play.title}
            </h2>
          </div>
          <button type="button" className="gx-close" aria-label="Close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p className="gx-sub">
          Publish the same play twice with two different hooks. Log each one's numbers in Results to
          see which wins.
        </p>
        <label className="gx-label" htmlFor="gx-a">
          Hook A
        </label>
        <textarea
          id="gx-a"
          className="tf-in gx-input"
          rows={2}
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
        <label className="gx-label" htmlFor="gx-b">
          Hook B
        </label>
        <textarea
          id="gx-b"
          ref={bRef}
          className="tf-in gx-input"
          rows={2}
          placeholder="A different opening line for the same idea"
          value={b}
          onChange={(e) => setB(e.target.value)}
        />
        <div className="gx-row">
          <div style={{ flex: "1 1 200px" }}>
            <label className="gx-label" htmlFor="gx-metric">
              Decide by
            </label>
            <select
              id="gx-metric"
              className="tf-in gx-input"
              value={metric}
              onChange={(e) => setMetric(e.target.value as ExperimentMetric)}
            >
              {METRICS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "2 1 260px" }}>
            <label className="gx-label" htmlFor="gx-hyp">
              Hypothesis <span style={{ fontWeight: 400, opacity: 0.8 }}>optional</span>
            </label>
            <input
              id="gx-hyp"
              className="tf-in gx-input"
              placeholder={`Hook B earns more ${metricLabel} than hook A.`}
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
            />
          </div>
        </div>
        {err && (
          <div className="gx-err" role="alert">
            {err}
          </div>
        )}
        <div className="gx-actions">
          <button type="button" className="gh-btn gh-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="gh-btn gh-btn--primary"
            disabled={saving}
            onClick={submit}
          >
            {saving ? "Starting" : "Start experiment"}
          </button>
        </div>
      </div>
    </div>
  );
}
