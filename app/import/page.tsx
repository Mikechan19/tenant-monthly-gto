import { CsvImport } from "@/components/CsvImport";
import { Card, PageHeader } from "@/components/ui";

export default function ImportPage() {
  return (
    <>
      <PageHeader title="CSV import" subtitle="Bulk-load sales from a tenant’s POS export or your existing Excel sheet (save as CSV)." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" eyebrow="Bulk import" title="Upload or paste">
          <CsvImport />
        </Card>
        <Card eyebrow="Reference" title="Format">
          <ul className="space-y-2 text-sm text-ink-2">
            <li>
              <b className="text-ink">Header row required.</b> Columns are case-insensitive.
            </li>
            <li>
              <code className="rounded-md bg-panel px-1.5 py-0.5 font-mono text-[0.8em] text-primary">tenant</code> (name) or <code className="rounded-md bg-panel px-1.5 py-0.5 font-mono text-[0.8em] text-primary">unit</code> — must match an existing tenant.
            </li>
            <li>
              <code className="rounded-md bg-panel px-1.5 py-0.5 font-mono text-[0.8em] text-primary">date</code> — <code>YYYY-MM-DD</code> or <code>DD/MM/YYYY</code>.
            </li>
            <li>
              <code className="rounded-md bg-panel px-1.5 py-0.5 font-mono text-[0.8em] text-primary">amount</code> — RM, ≥ 0. Commas allowed.
            </li>
            <li>
              <code className="rounded-md bg-panel px-1.5 py-0.5 font-mono text-[0.8em] text-primary">period_type</code> — hourly / daily / weekly / monthly (default daily).
            </li>
            <li>
              <code className="rounded-md bg-panel px-1.5 py-0.5 font-mono text-[0.8em] text-primary">hour</code> — 0–23, for hourly rows.
            </li>
            <li>
              <code className="rounded-md bg-panel px-1.5 py-0.5 font-mono text-[0.8em] text-primary">outlet</code> — optional, for tenants with several outlets (e.g. two shops of one tenant). Monthly GTO adds outlets together.
            </li>
            <li>Preview first: rows with errors are listed and skipped; you confirm the batch before anything is saved. Imported rows are tagged <i>import</i>.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
