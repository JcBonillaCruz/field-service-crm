"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import BarcodeScanner from "@/components/catalog/BarcodeScanner";

type Code = { id: string; code: string; label: string | null };

// Códigos extra de un producto: el mismo repuesto de otra marca, el código de la caja, etc.
// Escanear cualquiera de ellos encuentra este producto.
export default function ExtraCodes({ companyId, itemId, initial }: { companyId: string; itemId: string; initial: Code[] }) {
  const [codes, setCodes] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(value = code) {
    const v = value.trim();
    if (!v) return setError("Scan or type the code.");
    setBusy(true); setError("");
    const { data, error: err } = await createClient().from("item_barcodes").insert({ company_id: companyId, item_id: itemId, code: v, label: label.trim() || null }).select("id, code, label").single();
    setBusy(false);
    if (err || !data) {
      const m = `${err?.message ?? ""} ${err?.hint ?? ""}`;
      return setError(err?.code === "23505" ? "That code is already used by a product." : m.includes("CODE_IS_SKU") ? "That code is already the SKU of another product." : m.includes("does not exist") ? "Run the SQL for Paso 4.5 first." : "It couldn't be saved.");
    }
    setCodes((l) => [...l, data as Code]); setCode(""); setLabel(""); setAdding(false);
  }
  async function remove(c: Code) {
    if (!(await confirmDelete({ title: `Remove code ${c.code}?`, message: "Scanning it won't find this product anymore." }))) return;
    const { error: err } = await createClient().from("item_barcodes").delete().eq("id", c.id);
    if (err) return setError("It couldn't be removed.");
    setCodes((l) => l.filter((x) => x.id !== c.id));
  }

  return (
    <div className="mx-5 mt-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[14.5px] font-semibold text-[#0b1f3a]">Other barcodes</p>
          <p className="text-[12.5px] text-slate-500">Same part from another brand, or the code on the box. Scanning any of them finds this product.</p>
        </div>
        {!adding && <button type="button" onClick={() => { setAdding(true); setError(""); }} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-[13.5px] font-medium text-[#0f766e] hover:border-[#14a39a] hover:bg-[#e9f7f4]">+ Add code</button>}
      </div>
      {codes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {codes.map((c) => (
            <span key={c.id} className="group inline-flex items-center gap-1.5 rounded-lg bg-slate-100 py-1 pl-2.5 pr-1 text-[13px]">
              <span className="font-mono text-slate-700">{c.code}</span>{c.label && <span className="text-slate-500">· {c.label}</span>}
              <button type="button" onClick={() => remove(c)} aria-label={`Remove ${c.code}`} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600">
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}
      {adding && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input autoFocus value={code} onChange={(e) => { setCode(e.target.value); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} placeholder="Scan or type the code"
            className="h-10 min-w-0 flex-1 basis-44 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-[14px] focus:border-[#0f766e] focus:bg-white focus:outline-none" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Brand / note (optional)"
            className="h-10 min-w-0 flex-1 basis-36 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[14px] focus:border-[#0f766e] focus:bg-white focus:outline-none" />
          <button type="button" onClick={() => setScan(true)} aria-label="Scan" className="flex h-10 w-11 items-center justify-center rounded-lg border border-slate-200 text-[#0f766e] hover:border-[#14a39a] hover:bg-[#e9f7f4]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M16.5 8v8" /></svg>
          </button>
          <button type="button" disabled={busy} onClick={() => save()} className="rounded-lg bg-[#0f766e] px-4 text-[14px] font-semibold text-white hover:bg-[#0c5f59] disabled:opacity-60">{busy ? "Saving..." : "Save"}</button>
          <button type="button" onClick={() => { setAdding(false); setCode(""); setLabel(""); setError(""); }} className="px-2 text-[14px] text-slate-500 hover:text-slate-700">Cancel</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-[13px] text-red-600">{error}</p>}
      <BarcodeScanner open={scan} everywhere onClose={() => setScan(false)} onCode={(c) => { setScan(false); setCode(c); save(c); }} />
    </div>
  );
}
