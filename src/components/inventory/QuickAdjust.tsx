"use client";

import { useState } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import SelectMenu from "@/components/ui/SelectMenu";
import { ADD_REASONS, InvItem, InvLocation, InvStock, REMOVE_REASONS, invError, pingAlerts, qtyFmt } from "@/lib/inventory";

type Props = {
  companyId: string; item: InvItem; locations: InvLocation[]; rows: InvStock[];
  onDone: (msg: string, ok: boolean) => void; size?: "sm" | "lg";
};

// Ajuste rápido de stock:
//   · + / − con UN clic → suma o resta 1 unidad (queda firmado como movimiento)
//   · el botón de en medio abre un mini panel para cantidades, ubicación y motivo
export default function QuickAdjust({ companyId, item, locations, rows, onDone, size = "sm" }: Props) {
  const [busy, setBusy] = useState(false);
  const def = locations.find((l) => l.is_default) ?? locations[0];
  const qtyAt = (id: string) => Number(rows.find((r) => r.location_id === id)?.qty ?? 0);
  // Para restar: la bodega principal si tiene; si no, la ubicación con más unidades
  const removeFrom = () => (def && qtyAt(def.id) > 0 ? def : [...locations].sort((a, b) => qtyAt(b.id) - qtyAt(a.id))[0]);

  async function move(kind: string, qty: number, from: string | null, to: string | null, reason: string) {
    setBusy(true);
    const { error } = await createClient().rpc("inv_move", {
      p_company: companyId, p_item: item.id, p_kind: kind, p_qty: qty, p_from: from, p_to: to, p_reason: reason,
    });
    setBusy(false);
    if (error) { onDone(invError(error), false); return false; }
    pingAlerts();
    onDone(`${item.name}: ${kind === "receive" || to ? "+" : "−"}${qtyFmt(qty)}`, true);
    return true;
  }

  const plus = () => def && move("receive", 1, null, def.id, "Quick add");
  const minus = () => {
    const loc = removeFrom();
    if (!loc || qtyAt(loc.id) <= 0) return onDone(`${item.name} is out of stock.`, false);
    move("adjust", 1, loc.id, null, "Quick remove");
  };

  const btn = size === "lg" ? "h-10 w-10 rounded-xl" : "h-8 w-8 rounded-lg";
  const icon = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button type="button" disabled={busy} onClick={minus} aria-label={`Remove 1 ${item.name}`} title="Remove 1"
        className={`group/q flex ${btn} items-center justify-center border border-slate-200 bg-white text-slate-600 transition-all duration-150 hover:border-[#fda4af] hover:bg-[#fff1f2] hover:text-[#be123c] active:scale-90 disabled:opacity-50`}>
        <svg viewBox="0 0 20 20" className={`${icon} transition-transform duration-150 group-hover/q:scale-110`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 10h10" /></svg>
      </button>
      <AdjustPopover companyId={companyId} item={item} locations={locations} qtyAt={qtyAt} def={def} busy={busy} size={size} move={move} />
      <button type="button" disabled={busy} onClick={plus} aria-label={`Add 1 ${item.name}`} title="Add 1"
        className={`group/q flex ${btn} items-center justify-center border border-slate-200 bg-white text-slate-600 transition-all duration-150 hover:border-[#99e0d2] hover:bg-[#e9f7f4] hover:text-[#0f766e] active:scale-90 disabled:opacity-50`}>
        <svg viewBox="0 0 20 20" className={`${icon} transition-transform duration-150 group-hover/q:rotate-90`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg>
      </button>
    </div>
  );
}

function AdjustPopover({ item, locations, qtyAt, def, busy, size, move }: {
  companyId: string; item: InvItem; locations: InvLocation[]; qtyAt: (id: string) => number; def?: InvLocation; busy: boolean; size: "sm" | "lg";
  move: (kind: string, qty: number, from: string | null, to: string | null, reason: string) => Promise<boolean | undefined>;
}) {
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [qty, setQty] = useState("1");
  const [loc, setLoc] = useState(def?.id ?? "");
  const [reason, setReason] = useState(ADD_REASONS[0]);
  const [err, setErr] = useState("");
  const reasons = mode === "add" ? ADD_REASONS : REMOVE_REASONS;
  const n = Number(qty);

  async function apply(close: () => void) {
    if (!n || n <= 0) return setErr("Enter a quantity.");
    if (!loc) return setErr("Choose a location.");
    if (mode === "remove" && n > qtyAt(loc)) return setErr(`Only ${qtyFmt(qtyAt(loc))} in this location.`);
    setErr("");
    const ok = mode === "add"
      ? await move(reason === "Received purchase" ? "receive" : "adjust", n, null, loc, reason)
      : await move(reason === "Used on a job" ? "use" : "adjust", n, loc, null, reason);
    if (ok) { setQty("1"); close(); }
  }
  const switchMode = (m: "add" | "remove") => { setMode(m); setReason((m === "add" ? ADD_REASONS : REMOVE_REASONS)[0]); setErr(""); };

  return (
    <Popover>
      <PopoverButton disabled={busy} aria-label="Adjust stock" title="Adjust stock"
        className={`flex ${size === "lg" ? "h-10 px-3 rounded-xl" : "h-8 px-2 rounded-lg"} items-center justify-center text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-[#0f766e] focus:outline-none data-[open]:bg-[#e9f7f4] data-[open]:text-[#0f766e]`}>
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1M15 5v4M9 10v4M17 15v4" /></svg>
      </PopoverButton>
      <PopoverPanel anchor={{ to: "bottom end", gap: 6 }} transition
        className="z-[100] w-[18.5rem] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,40,60,0.18)] transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => (
          <div className="space-y-3">
            <p className="truncate text-sm font-semibold text-[#0b1f3a]">{item.name}</p>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {(["add", "remove"] as const).map((m) => (
                <button key={m} type="button" onClick={() => switchMode(m)}
                  className={`rounded-lg py-1.5 text-sm font-medium transition-all ${mode === m ? (m === "add" ? "bg-white text-[#0f766e] shadow-sm" : "bg-white text-[#be123c] shadow-sm") : "text-slate-500 hover:text-slate-700"}`}>
                  {m === "add" ? "Add stock" : "Remove stock"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQty(String(Math.max(1, (n || 1) - 1)))} className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 text-lg text-slate-600 hover:bg-slate-50 active:scale-95">−</button>
              <input value={qty} inputMode="decimal" onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Quantity"
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 text-center text-[16px] font-semibold tabular-nums focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
              <button type="button" onClick={() => setQty(String((n || 0) + 1))} className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 text-lg text-slate-600 hover:bg-slate-50 active:scale-95">+</button>
            </div>
            {locations.length > 1 && (
              <SelectMenu ariaLabel="Location" value={loc} onChange={setLoc}
                options={locations.map((l) => ({ value: l.id, label: `${l.name} · ${qtyFmt(qtyAt(l.id))}` }))} />
            )}
            <SelectMenu ariaLabel="Reason" value={reason} onChange={setReason} options={reasons.map((r) => ({ value: r, label: r }))} />
            {err && <p role="alert" className="text-[13px] text-red-600">{err}</p>}
            <button type="button" disabled={busy} onClick={() => apply(close)}
              className={`w-full rounded-lg py-2.5 text-[15px] font-semibold text-white transition-colors disabled:opacity-60 ${mode === "add" ? "bg-[#0f766e] hover:bg-[#0c5f59]" : "bg-[#be123c] hover:bg-[#9f1239]"}`}>
              {busy ? "Saving..." : mode === "add" ? `Add ${n > 0 ? qtyFmt(n) : ""}` : `Remove ${n > 0 ? qtyFmt(n) : ""}`}
            </button>
          </div>
        )}
      </PopoverPanel>
    </Popover>
  );
}
