"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { commitImport, previewImport, type ImportPreview } from "@/app/actions";
import { rm, dateTime } from "@/lib/format";
import { addDays, todayKey } from "@/lib/logic/dates";
import { useToast } from "./Toast";
import { Badge, btnPrimary, btnSecondary, inputCls } from "./ui";
import { useCanWrite } from "./Workspace";

const sample = () => `tenant,date,amount,period_type,hour
Coffee House,${todayKey()},420,hourly,18
Urban Fashion,${todayKey()},1200,daily,
Tech World,${addDays(todayKey(), -1).split("-").reverse().join("/")},"8,750.00",daily,
Unknown Shop,${todayKey()},500,daily,`;

export function CsvImport() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const router = useRouter();
  const toast = useToast();
  const canWrite = useCanWrite();

  async function onFile(f: File | undefined) {
    if (!f) return;
    const t = await f.text();
    setText(t);
    setPreview(null);
  }

  async function runPreview() {
    setBusy("preview");
    setPreview(await previewImport(text));
    setBusy(null);
  }

  async function runCommit() {
    setBusy("commit");
    const r = await commitImport(text);
    setBusy(null);
    if (r.ok) {
      toast(r.message ?? "Imported.");
      setText("");
      setPreview(null);
      router.push("/daily-report");
      router.refresh();
    } else toast(r.errors?.form ?? "Import failed.", "error");
  }

  const invalid = preview ? preview.rows.length - preview.validCount : 0;

  if (!canWrite)
    return (
      <p className="rounded-xl bg-panel px-3 py-2 text-sm text-ink-2">
        You have <b>viewer</b> access to this team, so you can’t import sales. Ask a team admin to make you an analyst.
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${btnSecondary} cursor-pointer`}>
          Choose CSV file
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <button type="button" className="min-h-11 px-1 text-sm font-semibold text-primary underline-offset-4 hover:underline sm:min-h-0" onClick={() => { setText(sample()); setPreview(null); }}>
          Load sample rows
        </button>
      </div>
      <label htmlFor="csv" className="sr-only">CSV text</label>
      <textarea
        id="csv"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
        rows={8}
        placeholder="tenant,date,amount,period_type,hour"
        className={`${inputCls.replace("sm:text-sm", "sm:text-xs")} font-mono`}
        wrap="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="flex flex-wrap gap-2 *:flex-1 sm:*:flex-none">
        <button type="button" className={btnSecondary} disabled={!text.trim() || busy !== null} onClick={runPreview}>
          {busy === "preview" ? "Checking…" : "Preview & validate"}
        </button>
        <button type="button" className={btnPrimary} disabled={!preview || preview.validCount === 0 || busy !== null} onClick={runCommit}>
          {busy === "commit" ? "Importing…" : preview ? `Import ${preview.validCount} valid row${preview.validCount === 1 ? "" : "s"}` : "Import"}
        </button>
      </div>

      {preview?.error && <p role="alert" className="rounded-xl bg-neg-bg px-3 py-2 text-sm text-rose-800">{preview.error}</p>}
      {preview && !preview.error && (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 text-sm">
            <Badge tone="emerald">{preview.validCount} valid</Badge>
            {invalid > 0 && <Badge tone="rose">{invalid} with errors (skipped)</Badge>}
          </div>
          {/* Phones: stacked rows */}
          <ul className="divide-y divide-row sm:hidden" data-testid="csv-preview-list">
            {preview.rows.map((r) => (
              <li key={r.line} className={`px-4 py-2.5 ${r.error ? "bg-rose-50/50" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{r.tenantName ?? r.raw.tenant ?? r.raw.unit ?? "—"}</div>
                    <div className="text-xs text-muted">
                      Line {r.line} · <span className="capitalize">{r.record?.period_type ?? r.raw.period_type ?? "—"}</span> ·{" "}
                      {r.record ? dateTime(r.record.recorded_at) : r.raw.date ?? "—"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-sm font-semibold num">
                    {r.record ? rm(r.record.amount, { cents: true }) : r.raw.amount ?? "—"}
                  </div>
                </div>
                <div className="mt-1 text-xs">{r.error ? <span className="text-neg">{r.error}</span> : <span className="text-pos">OK</span>}</div>
              </li>
            ))}
          </ul>
          <div className="hidden max-h-96 overflow-auto sm:block">
            <table className="data-grid w-full text-sm">
              <thead className="sticky top-0 bg-canvas">
                <tr className="text-left label-caps text-[11px] text-muted">
                  <th className="px-4 py-2">Line</th>
                  <th className="px-4 py-2">Tenant</th>
                  <th className="px-4 py-2">Period</th>
                  <th className="px-4 py-2">Outlet</th>
                  <th className="px-4 py-2">Recorded for</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-row">
                {preview.rows.map((r) => (
                  <tr key={r.line} className={r.error ? "bg-rose-50/50" : ""}>
                    <td className="px-4 py-2 text-muted">{r.line}</td>
                    <td className="px-4 py-2">{r.tenantName ?? r.raw.tenant ?? r.raw.unit ?? "—"}</td>
                    <td className="px-4 py-2 capitalize">{r.record?.period_type ?? r.raw.period_type ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-2">{r.record?.outlet ?? r.raw.outlet ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-2">{r.record ? dateTime(r.record.recorded_at) : r.raw.date ?? "—"}</td>
                    <td className="px-4 py-2 text-right num">{r.record ? rm(r.record.amount, { cents: true }) : r.raw.amount ?? "—"}</td>
                    <td className="px-4 py-2">{r.error ? <span className="text-neg">{r.error}</span> : <span className="text-pos">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
