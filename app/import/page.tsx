import { CsvImport } from "@/components/CsvImport";
import { Card, PageHeader } from "@/components/ui";

export default function ImportPage() {
  return (
    <>
      <PageHeader title="CSV import" subtitle="Bulk-load sales from a tenant’s POS export or your existing Excel sheet (save as CSV)." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Upload or paste">
          <CsvImport />
        </Card>
        <Card title="Format">
          <ul className="space-y-2 text-sm text-slate-600">
            <li>
              <b className="text-slate-900">Header row required.</b> Columns are case-insensitive.
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">tenant</code> (name) or <code className="rounded bg-slate-100 px-1">unit</code> — must match an existing tenant.
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">date</code> — <code>YYYY-MM-DD</code> or <code>DD/MM/YYYY</code>.
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">amount</code> — RM, ≥ 0. Commas allowed.
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">period_type</code> — hourly / daily / weekly / monthly (default daily).
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">hour</code> — 0–23, for hourly rows.
            </li>
            <li>Preview first: rows with errors are listed and skipped; you confirm the batch before anything is saved. Imported rows are tagged <i>import</i>.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
