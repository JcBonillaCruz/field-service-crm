"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { TechStock, qtyFmt } from "@/lib/inventory";

// =====================================================================
// Paso 6.12f · El técnico pide resurtido de su van → la oficina recibe el aviso
// =====================================================================
type Req = { id: string; items: { item_id: string; name: string; qty: number }[]; note: string | null; status: string; created_at: string; handled_by_name: string | null };

export default function RestockRequest({ companyId, vanId, userName, stock, autoOpen, onSent }: {
  companyId: string; vanId: string; userName: string; stock: TechStock[]; autoOpen: boolean; onSent: (msg: string) => void;
}) {
  const t = useTranslations("restock");
  const es = useLocale().startsWith("es");
  const [open, setOpen] = useState(autoOpen);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [reqs, setReqs] = useState<Req[] | null>(null);
  const mine = stock.filter((s) => s.location_id === vanId);
  const need = (s: TechStock) => Math.max(0, (s.min_qty > 0 ? s.min_qty * 2 : 0) - s.qty);

  const load = useCallback(async () => {
    const { data, error } = await createClient().from("inventory_restock_requests").select("id, items, note, status, created_at, handled_by_name")
      .eq("company_id", companyId).eq("location_id", vanId).order("created_at", { ascending: false }).limit(5);
    setReqs(error ? [] : ((data ?? []) as Req[]));
  }, [companyId, vanId]);
  useEffect(() => { load(); }, [load]);
  // Al abrir: precarga lo que está bajo el mínimo
  useEffect(() => {
    if (!open) return;
    setQty(Object.fromEntries(mine.filter((s) => s.min_qty > 0 && s.qty <= s.min_qty).map((s) => [s.item_id, qtyFmt(Math.max(1, need(s)))])));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const picked = mine.filter((s) => Number(qty[s.item_id]) > 0);
  async function send() {
    if (!picked.length) return setErr(t("ePick"));
    setBusy(true); setErr("");
    const items = picked.map((s) => ({ item_id: s.item_id, name: s.name, qty: Number(qty[s.item_id]) }));
    const { data, error } = await createClient().from("inventory_restock_requests")
      .insert({ company_id: companyId, location_id: vanId, requested_by_name: userName || null, items, note: note.trim() || null }).select("id").single();
    setBusy(false);
    if (error) return setErr(/relation|schema|does not exist/i.test(error.message) ? t("eSql") : /row-level|policy/i.test(error.message) ? t("eOff") : t("eSend"));
    fetch("/api/inventory/restock-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.id }) }).catch(() => undefined);
    setOpen(false); setNote(""); load(); onSent(t("sent"));
  }

  const pending = (reqs ?? []).find((r) => r.status === "open");
  const day = (iso: string) => new Date(iso).toLocaleString(es ? "es-US" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="group mt-3 flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-[0_10px_24px_rgba(15,40,60,0.07)]">
        <TruckArt />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-semibold text-[#0b1f3a]">{t("ask")}</span>
          <span className="block truncate text-[12.5px] text-slate-500">{pending ? t("pendingSince", { date: day(pending.created_at) }) : t("askHint")}</span>
        </span>
        {pending && <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700 ring-1 ring-amber-200">{t("pending")}</span>}
      </button>
      {(reqs ?? []).filter((r) => r.status === "done").slice(0, 1).map((r) => (
        <p key={r.id} className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800">{t("ready", { name: r.handled_by_name ?? "—" })}</p>
      ))}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-[bp-pop-in_0.2s_ease-out] sm:rounded-3xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <TruckArt />
              <div className="min-w-0 flex-1"><h2 className="truncate text-[17px] font-semibold text-[#0b1f3a]">{t("title")}</h2><p className="truncate text-[12.5px] text-slate-500">{t("subtitle")}</p></div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="group/x flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600">
                <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
              </button>
            </div>
            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {mine.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-500">{t("empty")}</li>}
              {[...mine].sort((a, b) => Number(b.min_qty > 0 && b.qty <= b.min_qty) - Number(a.min_qty > 0 && a.qty <= a.min_qty)).map((s) => {
                const low = s.min_qty > 0 && s.qty <= s.min_qty;
                return (
                  <li key={s.item_id} className={`flex items-center gap-3 px-5 py-3 ${Number(qty[s.item_id]) > 0 ? "bg-[#f3fbf8]" : ""}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-medium text-[#0b1f3a]">{s.name}</span>
                      <span className={`block truncate text-[12px] ${low ? "font-semibold text-amber-700" : "text-slate-500"}`}>{t("have", { n: qtyFmt(s.qty), min: qtyFmt(s.min_qty) })}</span>
                    </span>
                    <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-slate-200">
                      <button type="button" aria-label="-" onClick={() => setQty((x) => ({ ...x, [s.item_id]: String(Math.max(0, (Number(x[s.item_id]) || 0) - 1)) }))} className="h-10 w-9 text-lg text-slate-500 hover:bg-slate-50">−</button>
                      <input inputMode="decimal" value={qty[s.item_id] ?? ""} placeholder="0" onChange={(e) => setQty((x) => ({ ...x, [s.item_id]: e.target.value.replace(/[^0-9.]/g, "") }))}
                        aria-label={s.name} className="h-10 w-12 border-x border-slate-200 text-center text-[15px] font-semibold tabular-nums focus:outline-none" />
                      <button type="button" aria-label="+" onClick={() => setQty((x) => ({ ...x, [s.item_id]: String((Number(x[s.item_id]) || 0) + 1) }))} className="h-10 w-9 text-lg text-[#0f766e] hover:bg-[#e9f7f4]">+</button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-slate-100 px-5 py-4">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t("notePh")}
                className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-[15px] focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
              {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
              <button type="button" disabled={busy || !picked.length} onClick={send}
                className="mt-3 h-12 w-full whitespace-nowrap rounded-xl bg-[#0f766e] text-[16px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-50">{busy ? t("sending") : t("send", { n: picked.length })}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TruckArt() {
  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0 transition-transform duration-200 group-hover:scale-105" aria-hidden="true">
      <defs>
        <linearGradient id="rtA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2bb3a4" /><stop offset="1" stopColor="#0f766e" /></linearGradient>
        <linearGradient id="rtB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fdba74" /><stop offset="1" stopColor="#e8713a" /></linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="#e9f7f4" />
      <rect x="7" y="16" width="21" height="15" rx="2.5" fill="url(#rtA)" />
      <path d="M28 20h6.5l5 5.5V31H28z" fill="#0b5e57" />
      <path d="M30 21.8h4l3 3.4h-7z" fill="#bfeee7" />
      <rect x="11" y="9" width="11" height="9" rx="1.5" fill="url(#rtB)" />
      <path d="M16.5 9v4l1.5-1 1.5 1V9" fill="#fff" opacity=".7" />
      <circle cx="14" cy="32" r="3.6" fill="#0b1f3a" /><circle cx="14" cy="32" r="1.4" fill="#cbd5e1" />
      <circle cx="33" cy="32" r="3.6" fill="#0b1f3a" /><circle cx="33" cy="32" r="1.4" fill="#cbd5e1" />
      <circle cx="38" cy="13" r="6" fill="#fff" stroke="#e8713a" strokeWidth="1.6" />
      <path d="M38 10v6M35 13h6" stroke="#e8713a" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
