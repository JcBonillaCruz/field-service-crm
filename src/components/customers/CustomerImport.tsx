"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { ImportRow, SAMPLE_ROWS, TARGETS, TARGET_LABEL, autoMap, buildRow } from "@/lib/customer-import";
import SearchSelect, { SelectOption } from "@/components/ui/SearchSelect";
import { primaryButton, secondaryButton } from "@/components/customers/ui";

const MAX_ROWS = 5000;
const CHUNK = 200;
const STEPS = ["Upload file", "Map fields", "Review & import"];

const TARGET_OPTIONS: SelectOption[] = [
  { value: "", label: "Don't import", group: "Skip" },
  ...TARGETS.map((t) => ({ value: t.key, label: t.label, group: t.group })),
];

type Result = { imported: number; skipped: number; errors: { row: number; message: string }[] };

export default function CustomerImport({ companyId }: { companyId: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function readFile(file: File) {
    setError("");
    if (!/\.(csv|txt)$/i.test(file.name)) return setError("Choose a .csv file. In Excel or Google Sheets use File → Download → CSV.");
    if (file.size > 5 * 1024 * 1024) return setError("The file is larger than 5 MB.");
    const all = parseCsv(await file.text());
    if (all.length < 2) return setError("The file needs a header row and at least one customer.");
    if (all.length - 1 > MAX_ROWS) return setError(`The file has ${all.length - 1} rows. Import at most ${MAX_ROWS} at a time.`);
    const h = all[0].map((x, i) => x.trim() || `Column ${i + 1}`);
    setFileName(file.name);
    setHeaders(h);
    setRows(all.slice(1));
    setMapping(autoMap(h));
    setStep(1);
  }

  const built: ImportRow[] = useMemo(
    () => (step >= 2 ? rows.map((r, i) => buildRow(r, mapping, headers, i + 2)) : []),
    [step, rows, mapping, headers]
  );
  const ready = built.filter((r) => r.payload);
  const invalid = built.filter((r) => r.error);
  const warned = ready.filter((r) => r.warnings.length);

  const duplicates = mapping.filter((m, i) => m && mapping.indexOf(m) !== i);
  const hasName = mapping.some((m) => ["first_name", "last_name", "full_name", "company_name"].includes(m));

  async function runImport() {
    setProgress(0);
    setError("");
    const supabase = createClient();
    const total: Result = { imported: 0, skipped: 0, errors: invalid.map((r) => ({ row: r.row, message: r.error! })) };
    for (let i = 0; i < ready.length; i += CHUNK) {
      const chunk = ready.slice(i, i + CHUNK).map((r) => r.payload);
      const { data, error } = await supabase.rpc("import_customers", {
        p_company_id: companyId, p_rows: chunk, p_skip_duplicates: skipDuplicates,
      });
      if (error || !data) {
        setProgress(null);
        setResult(total.imported ? total : null);
        return setError("The import stopped because of a connection problem. Customers already imported were kept.");
      }
      const d = data as Result;
      total.imported += d.imported;
      total.skipped += d.skipped;
      total.errors.push(...d.errors.map((e) => ({ row: e.row, message: /email/i.test(e.message) ? "Invalid email" : "Couldn't save this row" })));
      setProgress(Math.min(100, Math.round(((i + chunk.length) / ready.length) * 100)));
    }
    total.errors.sort((a, b) => a.row - b.row);
    setResult(total);
    setProgress(null);
    router.refresh();
  }

  function reset() {
    setStep(0); setHeaders([]); setRows([]); setMapping([]); setResult(null); setError(""); setFileName("");
  }

  // ---------- Resultado ----------
  if (result) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d6f3ec] text-[#0f766e]">
          <svg viewBox="0 0 20 20" className="h-6 w-6" fill="currentColor" aria-hidden="true">
            <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-[#0b1f3a]">Import finished</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat n={result.imported} label="Imported" tone="ok" />
          <Stat n={result.skipped} label="Skipped (already exist)" />
          <Stat n={result.errors.length} label="Not imported" tone={result.errors.length ? "bad" : undefined} />
        </div>
        {result.errors.length > 0 && (
          <div className="mt-5 max-h-56 overflow-y-auto rounded-xl border border-slate-200">
            {result.errors.map((e, i) => (
              <p key={i} className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600 last:border-0">
                <span className="font-medium text-slate-800">Row {e.row}:</span> {e.message}
              </p>
            ))}
          </div>
        )}
        {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard/customers" className={primaryButton}>Go to customers</Link>
          <button type="button" onClick={reset} className={secondaryButton}>Import another file</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pasos */}
      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${i < step ? "bg-[#0f766e] text-white" : i === step ? "bg-[#d6f3ec] text-[#0f766e] ring-2 ring-[#14a39a]/40" : "bg-slate-100 text-slate-400"}`}>
              {i < step ? "✓" : i + 1}
            </span>
            <span className={`hidden sm:inline ${i === step ? "font-semibold text-[#0b1f3a]" : "text-slate-500"}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-slate-200 sm:w-10" />}
          </li>
        ))}
      </ol>

      {/* Paso 1: subir */}
      {step === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <button type="button" onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
            className={`flex w-full flex-col items-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${dragging ? "border-[#14a39a] bg-[#e9f7f4]" : "border-slate-300 hover:border-[#14a39a] hover:bg-[#f6fbfa]"}`}>
            <svg viewBox="0 0 24 24" className="h-10 w-10 text-[#14a39a]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="mt-3 font-semibold text-[#0b1f3a]">Drag your CSV file here or click to choose it</span>
            <span className="mt-1 text-sm text-slate-500">Up to {MAX_ROWS.toLocaleString()} customers · 5 MB max</span>
          </button>
          <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />

          {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <div className="mt-6 rounded-xl bg-[#f6fbfa] p-4 text-sm text-slate-600">
            <p className="font-medium text-[#0b1f3a]">Tips</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Files exported from Zoho, QuickBooks, Excel or Google Sheets work. We match the columns for you.</li>
              <li>A customer can have several phones, emails and addresses in the same row.</li>
              <li>Phones from other countries should start with + and the country code (e.g. +52).</li>
            </ul>
            <button type="button" onClick={() => downloadCsv("brightpro-customers-sample.csv", SAMPLE_ROWS)}
              className="mt-3 font-semibold text-[#0f766e] hover:underline">
              Download sample CSV
            </button>
          </div>
        </div>
      )}

      {/* Paso 2: asignar columnas */}
      {step === 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-[#0b1f3a]">Map your columns</h2>
            <p className="text-sm text-slate-500">{fileName} · {rows.length} rows</p>
          </div>
          <p className="mt-1 text-sm text-slate-500">We matched what we could. Check each column and choose where it goes in BrightPro.</p>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div className="hidden grid-cols-[1fr_1.4fr_1.2fr] gap-4 bg-slate-50/70 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
              <span>Column in your file</span><span>Example</span><span>BrightPro field</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {headers.map((h, i) => {
                const example = rows.find((r) => (r[i] ?? "").trim())?.[i] ?? "";
                const dup = mapping[i] && duplicates.includes(mapping[i]);
                return (
                  <li key={i} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_1.4fr_1.2fr] sm:items-center sm:gap-4">
                    <span className="truncate font-medium text-slate-800">{h}</span>
                    <span className="truncate text-sm text-slate-500">{example || <span className="text-slate-300">empty</span>}</span>
                    <div>
                      <SearchSelect value={mapping[i]} options={TARGET_OPTIONS} ariaLabel={`Field for ${h}`}
                        onChange={(v) => setMapping((m) => m.map((x, j) => (j === i ? v : x)))} />
                      {dup && <p className="mt-1 text-xs text-red-600">Also used by another column</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {!hasName && <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Map at least one name column (First name, Last name, Full name or Company name).</p>}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={reset} className={secondaryButton}>Back</button>
            <button type="button" disabled={!hasName || duplicates.length > 0} onClick={() => setStep(2)} className={primaryButton}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Paso 3: revisar */}
      {step === 2 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="text-base font-semibold text-[#0b1f3a]">Review</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat n={ready.length} label="Ready to import" tone="ok" />
            <Stat n={warned.length} label="With small issues" />
            <Stat n={invalid.length} label="Will be skipped" tone={invalid.length ? "bad" : undefined} />
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5">Row</th><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Phone</th><th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5">City</th><th className="px-4 py-2.5">Notes</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {built.slice(0, 8).map((r) => (
                  <tr key={r.row} className={r.error ? "bg-red-50/50" : ""}>
                    <td className="px-4 py-2.5 text-slate-400">{r.row}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.name || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.payload?.phones[0]?.number ?? ""}{(r.payload?.phones.length ?? 0) > 1 && <span className="text-xs text-slate-400"> +{r.payload!.phones.length - 1}</span>}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.payload?.emails[0]?.email ?? ""}{(r.payload?.emails.length ?? 0) > 1 && <span className="text-xs text-slate-400"> +{r.payload!.emails.length - 1}</span>}</td>
                    <td className="px-4 py-2.5 text-slate-600">{(r.payload?.addresses[0]?.city as string) ?? ""}</td>
                    <td className="px-4 py-2.5 text-xs">{r.error ? <span className="text-red-600">{r.error}</span> : <span className="text-amber-700">{r.warnings.join(" · ")}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {built.length > 8 && <p className="mt-2 text-xs text-slate-400">Showing the first 8 of {built.length} rows.</p>}

          {(invalid.length > 0 || warned.length > 0) && (
            <details className="mt-4 rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-slate-700">See all issues ({invalid.length + warned.length})</summary>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {[...invalid, ...warned].sort((a, b) => a.row - b.row).map((r) => (
                  <p key={r.row} className="text-slate-600"><span className="font-medium text-slate-800">Row {r.row}:</span> {r.error ?? r.warnings.join(" · ")}</p>
                ))}
              </div>
            </details>
          )}

          <label className="mt-5 flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0f766e]" />
            <span>Skip customers that already exist <span className="text-slate-500">(same name)</span></span>
          </label>

          <p className="mt-4 text-xs text-slate-400">Mapped fields: {mapping.filter(Boolean).map((m) => TARGET_LABEL.get(m)).join(", ")}</p>

          {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          {progress !== null && (
            <div className="mt-5">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#14a39a] transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-sm text-slate-500">Importing… {progress}%</p>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" disabled={progress !== null} onClick={() => setStep(1)} className={secondaryButton}>Back</button>
            <button type="button" disabled={progress !== null || ready.length === 0} onClick={runImport} className={primaryButton}>
              {progress !== null ? "Importing…" : `Import ${ready.length} ${ready.length === 1 ? "customer" : "customers"}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "ok" | "bad" }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone === "ok" ? "border-[#14a39a]/30 bg-[#f6fbfa]" : tone === "bad" ? "border-red-200 bg-red-50/60" : "border-slate-200"}`}>
      <p className={`text-2xl font-semibold ${tone === "ok" ? "text-[#0f766e]" : tone === "bad" ? "text-red-600" : "text-[#0b1f3a]"}`}>{n.toLocaleString()}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
