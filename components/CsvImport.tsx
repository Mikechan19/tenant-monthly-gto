"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { commitImport, previewImport, type ImportPreview } from "@/app/actions";
import { rm, dateTime } from "@/lib/format";
import { addDays, todayKey } from "@/lib/logic/dates";
import { useToast } from "./Toast";
import { Badge, btnPrimary, btnSecondary, inputCls } from "./ui";

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${btnSecondary} cursor-pointer`}>
          Choose CSV file
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <button type="button" className="text-sm font-medium text-teal-700 hover:underline" onClick={() => { setText(sample()); setPreview(null); }}>
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
        className={`${inputCls} font-mono text-xs`}
      />
      <div className="flex gap-2">
        <button type="button" className={btnSecondary} disabled={!text.trim() || busy !== null} onClick={runPreview}>
          {busy === "preview" ? "Checking…" : "Preview & validate"}
        </button>
        <button type="button" className={btnPrimary} disabled={!preview || preview.validCount === 0 || busy !== null} onClick={runCommit}>
          {busy === "commit" ? "Importing…" : preview ? `Import ${preview.validCount} valid row${preview.validCount === 1 ? "" : "s"}` : "Import"}
        </button>
      </div>

      {preview?.error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{preview.error}</p>}
      {preview && !preview.error && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm">
            <Badge tone="emerald">{preview.validCount} valid</Badge>
            {invalid > 0 && <Badge tone="rose">{invalid} with errors (skipped)</Badge>}
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Line</th>
                  <th className="px-4 py-2 font-medium">Tenant</th>
                  <th className="px-4 py-2 font-medium">Period</th>
                  <th className="px-4 py-2 font-medium">Recorded for</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.map((r) => (
                  <tr key={r.line} className={r.error ? "bg-rose-50/50" : ""}>
                    <td className="px-4 py-2 text-slate-500">{r.line}</td>
                    <td className="px-4 py-2">{r.tenantName ?? r.raw.tenant ?? r.raw.unit ?? "—"}</td>
                    <td className="px-4 py-2 capitalize">{r.record?.period_type ?? r.raw.period_type ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{r.record ? dateTime(r.record.recorded_at) : r.raw.date ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.record ? rm(r.record.amount, { cents: true }) : r.raw.amount ?? "—"}</td>
                    <td className="px-4 py-2">{r.error ? <span className="text-rose-700">{r.error}</span> : <span className="text-emerald-700">OK</span>}</td>
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
