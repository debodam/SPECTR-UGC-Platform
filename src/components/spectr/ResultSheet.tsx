import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Format } from "@/lib/spectr-store";

export interface ResultValues {
  impressions: number;
  engagementRate: number;
  followersGained: number;
  notes: string;
}

/** Quick sheet for logging a posted piece's numbers. Title, format and source come prefilled from the content. */
export function ResultSheet({
  title,
  format,
  onCancel,
  onSave,
}: {
  title: string;
  format: Format;
  onCancel: () => void;
  onSave: (v: ResultValues) => Promise<void>;
}) {
  const [imp, setImp] = useState("");
  const [eng, setEng] = useState("");
  const [fol, setFol] = useState("");
  const [notes, setNotes] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const validate = () => {
    const e: Record<string, string> = {};
    const i = Number(imp),
      r = Number(eng),
      f = Number(fol);
    if (imp.trim() === "" || !Number.isInteger(i) || i < 0)
      e.imp = "Enter impressions as a whole number, 0 or more";
    if (eng.trim() === "" || !Number.isFinite(r) || r < 0 || r > 100)
      e.eng = "Enter a rate between 0 and 100";
    if (fol.trim() !== "" && (!Number.isInteger(f) || f < -100000))
      e.fol = "Enter followers gained as a whole number";
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        impressions: Number(imp),
        engagementRate: Math.round(Number(eng) * 100) / 100,
        followersGained: Number(fol || 0),
        notes: notes.trim(),
      });
    } catch {
      setSaving(false);
    }
  };

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    opts: { placeholder: string; err?: string; step?: string; ref?: React.Ref<HTMLInputElement> },
  ) => (
    <div>
      <label className="gx-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        ref={opts.ref}
        className="tf-in gx-input"
        type="number"
        inputMode="decimal"
        step={opts.step ?? "1"}
        min="0"
        placeholder={opts.placeholder}
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-invalid={!!opts.err}
        aria-describedby={opts.err ? `${id}-err` : undefined}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {opts.err && (
        <div id={`${id}-err`} className="ds-err">
          {opts.err}
        </div>
      )}
    </div>
  );

  return (
    <div
      className="gx-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="gx-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rs-title"
        style={{ maxWidth: 520 }}
      >
        <div className="gx-head">
          <div>
            <div className="gh-eyebrow">Log results · {format}</div>
            <h2 id="rs-title" className="gh-h2">
              {title}
            </h2>
          </div>
          <button type="button" className="gx-close" aria-label="Close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p className="gx-sub">
          Copy these from LinkedIn's post analytics. They feed your forecast, format intelligence
          and insights.
        </p>
        <div className="rs-grid">
          {field("rs-imp", "Impressions", imp, setImp, {
            placeholder: "0",
            err: errs.imp,
            ref: first,
          })}
          {field("rs-eng", "Engagement rate (%)", eng, setEng, {
            placeholder: "0.0",
            err: errs.eng,
            step: "0.1",
          })}
          {field("rs-fol", "Followers gained", fol, setFol, { placeholder: "0", err: errs.fol })}
        </div>
        <label className="gx-label" htmlFor="rs-notes">
          Notes <span className="su-optional">Optional</span>
        </label>
        <input
          id="rs-notes"
          className="tf-in gx-input"
          placeholder="Anything worth remembering about how it did"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
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
            {saving ? "Saving" : "Save results"}
          </button>
        </div>
      </div>
    </div>
  );
}
