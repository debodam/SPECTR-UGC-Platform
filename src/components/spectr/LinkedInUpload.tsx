import { useRef, useState } from "react";
import type { Workspace } from "@/lib/spectr-store";
import { errMessage } from "@/lib/utils";
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { parseLinkedInFile, type LinkedInFileType, type ParsedMetrics } from "@/lib/linkedin-xls";

interface SlotDef {
  type: LinkedInFileType;
  title: string;
  hint: string;
  fields: { key: keyof ParsedMetrics; label: string }[];
}

const SLOTS: SlotDef[] = [
  {
    type: "content",
    title: "Content",
    hint: "Analytics → Content export",
    fields: [
      { key: "weeklyImpressions", label: "Weekly Impressions" },
      { key: "engagementRate", label: "Engagement Rate" },
    ],
  },
  {
    type: "visitors",
    title: "Visitors",
    hint: "Analytics → Visitors export",
    fields: [{ key: "monthlyVisitors", label: "Monthly Visitors" }],
  },
  {
    type: "leads",
    title: "Follower Growth",
    hint: "Analytics → Followers export",
    fields: [{ key: "followerGrowth", label: "Avg Weekly Growth" }],
  },
];

type Status = "idle" | "parsing" | "done" | "error";

interface SlotState {
  status: Status;
  message: string;
  parsed: Partial<Record<keyof ParsedMetrics, string>>;
}

const IDLE: SlotState = { status: "idle", message: "", parsed: {} };

interface Props {
  ws: Workspace;
  setWorkspace: (patch: Partial<Workspace>) => void;
}

export function LinkedInUploadSlots({ ws, setWorkspace }: Props) {
  const [states, setStates] = useState<Record<LinkedInFileType, SlotState>>({
    content: IDLE,
    visitors: IDLE,
    leads: IDLE,
  });

  const inputRefs = {
    content: useRef<HTMLInputElement>(null),
    visitors: useRef<HTMLInputElement>(null),
    leads: useRef<HTMLInputElement>(null),
  };

  function patch(type: LinkedInFileType, p: Partial<SlotState>) {
    setStates((s) => ({ ...s, [type]: { ...s[type], ...p } }));
  }

  async function handleFile(type: LinkedInFileType, file: File | undefined) {
    if (!file) return;
    patch(type, { status: "parsing", message: "", parsed: {} });
    try {
      const metrics = await parseLinkedInFile(file, type);
      setWorkspace({ baseline: { ...ws.baseline, ...metrics } });
      patch(type, { status: "done", parsed: metrics });
    } catch (err) {
      patch(type, { status: "error", message: errMessage(err) ?? "Parse failed." });
    }
  }

  function clear(type: LinkedInFileType) {
    patch(type, IDLE);
    const ref = inputRefs[type];
    if (ref.current) ref.current.value = "";
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Auto-fill from LinkedIn exports
        </span>
        <span
          className="text-[11px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: "rgba(10,102,194,0.08)", color: "var(--color-primary)" }}
        >
          Optional
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {SLOTS.map((slot) => (
          <Slot
            key={slot.type}
            def={slot}
            state={states[slot.type]}
            inputRef={inputRefs[slot.type]}
            onFile={(f) => handleFile(slot.type, f)}
            onClear={() => clear(slot.type)}
          />
        ))}
      </div>

      <p className="text-[11px] mt-2" style={{ color: "var(--color-text-secondary)" }}>
        Files are parsed in your browser — nothing is uploaded or stored. You can still edit the
        numbers manually below.
      </p>
    </div>
  );
}

function Slot({
  def,
  state,
  inputRef,
  onFile,
  onClear,
}: {
  def: SlotDef;
  state: SlotState;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-2 min-h-[100px]"
      style={{
        border: `1px solid ${
          state.status === "done"
            ? "var(--color-success)"
            : state.status === "error"
              ? "var(--color-destructive)"
              : "var(--color-border)"
        }`,
        background: "var(--color-surface)",
        transition: "border-color 0.15s",
      }}
    >
      <div className="text-xs font-bold">{def.title}</div>
      <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
        {def.hint}
      </div>

      <div className="mt-auto">
        {state.status === "idle" && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-semibold w-full justify-center py-1.5 rounded-md transition-colors"
            style={{
              border: "1px dashed var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            <Upload size={11} />
            Upload .xlsx
          </button>
        )}

        {state.status === "parsing" && (
          <div
            className="flex items-center gap-1.5 text-xs py-1"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <Loader2 size={12} className="animate-spin" />
            Parsing…
          </div>
        )}

        {state.status === "done" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <div
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: "var(--color-success)" }}
              >
                <CheckCircle2 size={12} />
                Filled in
              </div>
              <button
                type="button"
                onClick={onClear}
                className="text-xs rounded p-0.5 hover:opacity-70"
                style={{ color: "var(--color-text-secondary)" }}
                title="Clear and re-upload"
              >
                <X size={12} />
              </button>
            </div>
            {def.fields
              .filter((f) => state.parsed[f.key] !== undefined)
              .map((f) => (
                <div
                  key={f.key}
                  className="text-[11px]"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {f.label}:{" "}
                  <span className="font-semibold" style={{ color: "var(--color-foreground)" }}>
                    {f.key === "engagementRate"
                      ? `${state.parsed[f.key]}%`
                      : Number(state.parsed[f.key]).toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        )}

        {state.status === "error" && (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <div
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: "var(--color-destructive)" }}
              >
                <AlertCircle size={12} />
                Failed
              </div>
              <button
                type="button"
                onClick={onClear}
                className="text-xs rounded p-0.5 hover:opacity-70"
                style={{ color: "var(--color-text-secondary)" }}
              >
                <X size={12} />
              </button>
            </div>
            <div className="text-[11px] leading-snug" style={{ color: "var(--color-destructive)" }}>
              {state.message}
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}
