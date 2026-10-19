"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Módulos que tendrá el export (solo Customers funciona hoy; el resto llega después)
const MODULE_GROUPS: { group: string; items: string[] }[] = [
  { group: "Contacts", items: ["Customers", "Contact persons", "Contact's addresses"] },
  { group: "Sales", items: ["Quotes", "Invoices", "Invoice payments", "Subscriptions", "Credit notes", "Credit notes applied to invoices", "Refunds"] },
  { group: "Purchases", items: ["Expenses", "Recurring expenses"] },
  { group: "Projects", items: ["Projects", "Tasks", "Timesheets"] },
  { group: "Items & other", items: ["Items", "Coupons", "Price lists", "Exchange rates", "Taxes", "Users", "Documents"] },
];
const ENABLED = new Set(["Customers"]);

const DECIMALS = ["1,234,567.89", "1234567.89", "1.234.567,89", "1,23,456.78"];

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";

function pwIssues(p: string) {
  if (!p) return [];
  const out: string[] = [];
  if (p.length < 12) out.push("12+ characters");
  if (!/[A-Z]/.test(p)) out.push("an uppercase letter");
  if (!/[a-z]/.test(p)) out.push("a lowercase letter");
  if (!/\d/.test(p)) out.push("a number");
  if (!/[^A-Za-z0-9]/.test(p)) out.push("a symbol");
  return out;
}

export default function ExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [module, setModule] = useState("Customers");
  const [moduleOpen, setModuleOpen] = useState(false);
  const [moduleQuery, setModuleQuery] = useState("");
  const [records, setRecords] = useState<"all" | "period">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [decimal, setDecimal] = useState(DECIMALS[0]);
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const moduleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  useEffect(() => {
    if (!moduleOpen) return;
    const onDown = (e: MouseEvent) => { if (moduleRef.current && !moduleRef.current.contains(e.target as Node)) setModuleOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moduleOpen]);

  const filteredGroups = useMemo(() => {
    const q = moduleQuery.trim().toLowerCase();
    return MODULE_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.toLowerCase().includes(q)) })).filter((g) => g.items.length);
  }, [moduleQuery]);

  if (!open) return null;

  async function runExport() {
    setError("");
    if (password && format !== "xlsx") return setError("A password only works with Excel (.xlsx). Choose Excel or remove the password.");
    if (password) {
      const issues = pwIssues(password);
      if (issues.length) return setError(`Password needs ${issues.join(", ")}.`);
    }
    if (records === "period" && from && to && from > to) return setError("The start date must be before the end date.");

    setBusy(true);
    try {
      const res = await fetch("/dashboard/customers/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "all", format, password: password || undefined, decimal,
          period: records === "period" ? { from: from || undefined, to: to || undefined } : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setBusy(false);
        return setError(j.error || "The export failed. Please try again.");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const name = /filename="([^"]+)"/.exec(cd)?.[1] || `customers.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBusy(false);
      onClose();
    } catch {
      setBusy(false);
      setError("The export failed. Please try again.");
    }
  }

  const Label = ({ children, req }: { children: React.ReactNode; req?: boolean }) => (
    <label className="mb-1.5 block text-sm font-medium text-slate-700">{children}{req && <span className="text-red-500"> *</span>}</label>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Encabezado + X roja animada */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-[#0b1f3a]">Export customers</h2>
          <button type="button" onClick={onClose} aria-label="Close" title="Close"
            className="group flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-all duration-200 hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <p className="mb-5 rounded-lg bg-[#eef6ff] px-4 py-3 text-sm text-slate-600">You can export your data in CSV or Excel. Excel files can be protected with a password.</p>

          {/* Módulo */}
          <div className="mb-5" ref={moduleRef}>
            <Label req>Module</Label>
            <div className="relative">
              <button type="button" onClick={() => setModuleOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[15px] text-slate-800 hover:bg-white focus:outline-none">
                {module}
                <svg viewBox="0 0 20 20" className={`h-5 w-5 text-slate-400 transition-transform ${moduleOpen ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
              </button>
              {moduleOpen && (
                <div className="absolute z-10 mt-1 max-h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,40,60,0.16)]">
                  <div className="p-2">
                    <input autoFocus value={moduleQuery} onChange={(e) => setModuleQuery(e.target.value)} placeholder="Search" className={inputClass} />
                  </div>
                  <div className="max-h-56 overflow-y-auto pb-1">
                    {filteredGroups.map((g) => (
                      <div key={g.group}>
                        <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.group}</p>
                        {g.items.map((i) => {
                          const enabled = ENABLED.has(i);
                          return (
                            <button key={i} type="button" disabled={!enabled}
                              onClick={() => { setModule(i); setModuleOpen(false); setModuleQuery(""); }}
                              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${enabled ? "text-slate-700 hover:bg-[#f0faf7]" : "cursor-not-allowed text-slate-300"}`}>
                              {i}
                              {!enabled && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Soon</span>}
                              {enabled && module === i && <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#0f766e]" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Todos / periodo */}
          <div className="mb-5">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="records" checked={records === "all"} onChange={() => setRecords("all")} className="h-4 w-4 accent-[#0f766e]" />
                All customers
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="records" checked={records === "period"} onChange={() => setRecords("period")} className="h-4 w-4 accent-[#0f766e]" />
                Specific period <span className="text-slate-400">(by created date)</span>
              </label>
            </div>
            {records === "period" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div><Label>From</Label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} /></div>
                <div><Label>To</Label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} /></div>
              </div>
            )}
          </div>

          {/* Formato decimal */}
          <div className="mb-5">
            <Label req>Decimal format</Label>
            <select value={decimal} onChange={(e) => setDecimal(e.target.value)} className={inputClass}>
              {DECIMALS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">Applies to amount columns (invoices, payments…) when those modules are ready.</p>
          </div>

          {/* Formato de archivo */}
          <div className="mb-5">
            <Label req>Export file format</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="format" checked={format === "csv"} onChange={() => { setFormat("csv"); setPassword(""); }} className="h-4 w-4 accent-[#0f766e]" />
                CSV (Comma Separated Value)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="format" checked={format === "xlsx"} onChange={() => setFormat("xlsx")} className="h-4 w-4 accent-[#0f766e]" />
                Excel (.xlsx) <span className="rounded-full bg-[#d6f3ec] px-2 py-0.5 text-[11px] font-medium text-[#0f766e]">supports password</span>
              </label>
            </div>
          </div>

          {/* Contraseña */}
          <div>
            <Label>File protection password <span className="font-normal text-slate-400">(optional)</span></Label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={password} disabled={format !== "xlsx"} autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)} placeholder={format === "xlsx" ? "Leave empty for no password" : "Only available for Excel"}
                className={`${inputClass} pr-10 ${format !== "xlsx" ? "opacity-50" : ""}`} />
              {format === "xlsx" && (
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label="Show password"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 10s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z" /><circle cx="10" cy="10" r="2.5" /></svg>
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">At least 12 characters with an uppercase letter, a lowercase letter, a number and a symbol.</p>
          </div>

          {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={runExport} disabled={busy}
            className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f58] disabled:opacity-60">
            {busy ? "Exporting…" : "Export"}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}
