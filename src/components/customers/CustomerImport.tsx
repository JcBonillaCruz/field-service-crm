"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { ImportRow, SAMPLE_ROWS, TARGETS, TARGET_LABEL, autoMap, buildRow } from "@/lib/customer-import";
import SearchSelect, { SelectOption } from "@/components/ui/SearchSelect";
import { primaryButton, secondaryButton } from "@/components/customers/ui";
import { useTranslations } from "next-intl";

const MAX_ROWS = 5000;
const CHUNK = 200;
const STEPS = ["step1", "step2", "step3"];

// Paso 6.2b2: el nombre de cada campo de BrightPro en el idioma (la clave del campo no cambia)
type Tr = (k: string, v?: Record<string, string | number>) => string;
function targetName(key: string, t: Tr): string {
  let m = /^(phone|phoneLabel|email|emailLabel):(\d+)$/.exec(key);
  if (m) return t(`f_${m[1]}`, { n: m[2] });
  m = /^addr(\d+):(\w+)$/.exec(key);
  if (m) return `${t("f_address", { n: m[1] })} · ${t(`a_${m[2]}`)}`;
  return t(`f_${key}`);
}
function targetGroup(g: string, t: Tr): string {
  const m = /^Address (\d+)$/.exec(g);
  return m ? t("f_address", { n: m[1] }) : t(`g_${g}`);
}

type Result = { imported: number; skipped: number; errors: { row: number; message: string }[] };

export default function CustomerImport({ companyId }: { companyId: string }) {
  const t = useTranslations("custImport");
  const tr = t as unknown as Tr;
  const TARGET_OPTIONS: SelectOption[] = useMemo(() => [
    { value: "", label: t("dontImport"), group: t("g_Skip") },
    ...TARGETS.map((x) => ({ value: x.key, label: targetName(x.key, tr), group: targetGroup(x.group, tr), search: x.label })),
  ], [t]); // eslint-disable-line react-hooks/exhaustive-deps
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
    if (!/\.(csv|txt)$/i.test(file.name)) return setError(t("eCsv"));
    if (file.size > 5 * 1024 * 1024) return setError(t("e5mb"));
    const all = parseCsv(await file.text());
    if (all.length < 2) return setError(t("eEmpty"));
    if (all.length - 1 > MAX_ROWS) return setError(t("eTooMany", { n: all.length - 1, max: MAX_ROWS }));
    const h = all[0].map((x, i) => x.trim() || t("columnN", { n: i + 1 }));
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
        return setError(t("eStopped"));
      }
      const d = data as Result;
      total.imported += d.imported;
      total.skipped += d.skipped;
      total.errors.push(...d.errors.map((e) => ({ row: e.row, message: /email/i.test(e.message) ? t("badEmail") : t("badRow") })));
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
        <h2 className="mt-4 text-xl font-semibold text-[#0b1f3a]">{t("finished")}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat n={result.imported} label={t("imported")} tone="ok" />
          <Stat n={result.skipped} label={t("skipped")} />
          <Stat n={result.errors.length} label={t("notImported")} tone={result.errors.length ? "bad" : undefined} />
        </div>
        {result.errors.length > 0 && (
          <div className="mt-5 max-h-56 overflow-y-auto rounded-xl border border-slate-200">
            {result.errors.map((e, i) => (
              <p key={i} className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600 last:border-0">
                <span className="font-medium text-slate-800">{t("rowN", { n: e.row })}</span> {e.message}
              </p>
            ))}
          </div>
        )}
        {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link prefetch={false} href="/dashboard/customers" className={primaryButton}>{t("goCustomers")}</Link>
          <button type="button" onClick={reset} className={secondaryButton}>{t("another")}</button>
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
            <span className={`hidden sm:inline ${i === step ? "font-semibold text-[#0b1f3a]" : "text-slate-500"}`}>{t(s as never)}</span>
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
            <span className="mt-3 font-semibold text-[#0b1f3a]">{t("drag")}</span>
            <span className="mt-1 text-sm text-slate-500">{t("limits", { max: MAX_ROWS })}</span>
          </button>
          <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />

          {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <div className="mt-6 rounded-xl bg-[#f6fbfa] p-4 text-sm text-slate-600">
            <p className="font-medium text-[#0b1f3a]">{t("tips")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t("tip1")}</li>
              <li>{t("tip2")}</li>
              <li>{t("tip3")}</li>
            </ul>
            <button type="button" onClick={() => downloadCsv("brightpro-customers-sample.csv", SAMPLE_ROWS)}
              className="mt-3 font-semibold text-[#0f766e] hover:underline">
              {t("sample")}
            </button>
          </div>
        </div>
      )}

      {/* Paso 2: asignar columnas */}
      {step === 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-[#0b1f3a]">{t("mapTitle")}</h2>
            <p className="text-sm text-slate-500">{fileName} · {t("rows", { n: rows.length })}</p>
          </div>
          <p className="mt-1 text-sm text-slate-500">{t("mapIntro")}</p>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div className="hidden grid-cols-[1fr_1.4fr_1.2fr] gap-4 bg-slate-50/70 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
              <span>{t("colFile")}</span><span>{t("colExample")}</span><span>{t("colField")}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {headers.map((h, i) => {
                const example = rows.find((r) => (r[i] ?? "").trim())?.[i] ?? "";
                const dup = mapping[i] && duplicates.includes(mapping[i]);
                return (
                  <li key={i} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_1.4fr_1.2fr] sm:items-center sm:gap-4">
                    <span className="truncate font-medium text-slate-800">{h}</span>
                    <span className="truncate text-sm text-slate-500">{example || <span className="text-slate-300">{t("empty")}</span>}</span>
                    <div>
                      <SearchSelect value={mapping[i]} options={TARGET_OPTIONS} ariaLabel={t("fieldFor", { h })}
                        onChange={(v) => setMapping((m) => m.map((x, j) => (j === i ? v : x)))} />
                      {dup && <p className="mt-1 text-xs text-red-600">{t("dupCol")}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {!hasName && <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{t("needName")}</p>}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={reset} className={secondaryButton}>{t("back")}</button>
            <button type="button" disabled={!hasName || duplicates.length > 0} onClick={() => setStep(2)} className={primaryButton}>
              {t("continue")}
            </button>
          </div>
        </div>
      )}

      {/* Paso 3: revisar */}
      {step === 2 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="text-base font-semibold text-[#0b1f3a]">{t("review")}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat n={ready.length} label={t("ready")} tone="ok" />
            <Stat n={warned.length} label={t("small")} />
            <Stat n={invalid.length} label={t("willSkip")} tone={invalid.length ? "bad" : undefined} />
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5">{t("row")}</th><th className="px-4 py-2.5">{t("name")}</th><th className="px-4 py-2.5">{t("phone")}</th><th className="px-4 py-2.5">{t("email")}</th><th className="px-4 py-2.5">{t("city")}</th><th className="px-4 py-2.5">{t("notes")}</th></tr>
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
          {built.length > 8 && <p className="mt-2 text-xs text-slate-400">{t("first8", { n: built.length })}</p>}

          {(invalid.length > 0 || warned.length > 0) && (
            <details className="mt-4 rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-slate-700">{t("allIssues", { n: invalid.length + warned.length })}</summary>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {[...invalid, ...warned].sort((a, b) => a.row - b.row).map((r) => (
                  <p key={r.row} className="text-slate-600"><span className="font-medium text-slate-800">{t("rowN", { n: r.row })}</span> {r.error ?? r.warnings.join(" · ")}</p>
                ))}
              </div>
            </details>
          )}

          <label className="mt-5 flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0f766e]" />
            <span>{t("skipDup")} <span className="text-slate-500">({t("sameName")})</span></span>
          </label>

          <p className="mt-4 text-xs text-slate-400">{t("mapped")} {mapping.filter(Boolean).map((m) => (TARGET_LABEL.has(m) ? targetName(m, tr) : m)).join(", ")}</p>

          {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          {progress !== null && (
            <div className="mt-5">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#14a39a] transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-sm text-slate-500">{t("importing")} {progress}%</p>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" disabled={progress !== null} onClick={() => setStep(1)} className={secondaryButton}>{t("back")}</button>
            <button type="button" disabled={progress !== null || ready.length === 0} onClick={runImport} className={primaryButton}>
              {progress !== null ? t("importing") : t("importN", { n: ready.length })}
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
      <p className={`text-2xl font-semibold ${tone === "ok" ? "text-[#0f766e]" : tone === "bad" ? "text-red-600" : "text-[#0b1f3a]"}`}>{n.toLocaleString("en-US")}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
