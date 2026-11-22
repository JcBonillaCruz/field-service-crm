"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { invError, pingAlerts, qtyFmt } from "@/lib/inventory";

// Panel para que el técnico descuente lo que usó (o lo regrese a la bodega). Todo queda firmado a su nombre.
export default function TechUse({ companyId, itemId, itemName, unit, vanId, available, onDone }: {
  companyId: string; itemId: string; itemName: string; unit: string | null; vanId: string; available: number; onDone: (msg: string) => void;
}) {
  const t = useTranslations("van");
  const tc = useTranslations("common");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const n = Number(qty);

  async function go(kind: "use" | "return") {
    if (!n || n <= 0) return setErr(t("enterQty"));
    if (n > available) return setErr(t("onlyHave", { qty: qtyFmt(available) }));
    setBusy(true); setErr("");
    const sb = createClient();
    let to: string | null = null;
    if (kind === "return") {
      const { data, error } = await sb.rpc("inv_default_location", { p_company: companyId });
      if (error || !data) { setBusy(false); return setErr(invError(error)); }
      to = data as string;
    }
    const { error } = await sb.rpc("inv_move", {
      p_company: companyId, p_item: itemId, p_kind: kind, p_qty: n, p_from: vanId, p_to: to,
      p_reason: kind === "use" ? "Used on a job" : "Returned to warehouse", p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) return setErr(invError(error));
    if (navigator.vibrate) navigator.vibrate(40);
    pingAlerts();
    setQty("1"); setNote("");
    onDone(kind === "use" ? t("used", { qty: `${qtyFmt(n)} ${unit ?? ""}`.trim(), name: itemName }) : t("returned", { qty: qtyFmt(n), name: itemName }));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setQty(String(Math.max(1, (n || 1) - 1)))} className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 text-xl text-slate-600 active:scale-95">−</button>
        <input value={qty} inputMode="decimal" aria-label={t("quantity")} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ""))}
          className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 text-center text-xl font-semibold tabular-nums focus:border-[#0f766e] focus:bg-white focus:outline-none" />
        <button type="button" onClick={() => setQty(String((n || 0) + 1))} className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 text-xl text-slate-600 active:scale-95">+</button>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePh")}
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[15px] focus:border-[#0f766e] focus:bg-white focus:outline-none" />
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[14px] text-red-700">{err}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy || available <= 0} onClick={() => go("use")}
          className="flex-1 rounded-xl bg-[#ea580c] py-3 text-[15.5px] font-semibold text-white transition-colors hover:bg-[#c2410c] disabled:opacity-50">{busy ? tc("saving") : t("useOnJob")}</button>
        <button type="button" disabled={busy || available <= 0} onClick={() => go("return")}
          className="rounded-xl border border-slate-200 px-4 text-[14.5px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{t("return")}</button>
      </div>
    </div>
  );
}
