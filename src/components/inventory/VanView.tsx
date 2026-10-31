"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Toast } from "@/components/sales/SalesBits";
import TechUse from "@/components/inventory/TechUse";
import { STATUS_META, TechStock, invError, qtyFmt } from "@/lib/inventory";
import { LocIcon, card, pageWrap } from "@/components/inventory/PageBits";

// Técnico: su van. Solo ve lo suyo; al usar una pieza se descuenta de su van y del total de la empresa.
export default function VanView({ companyId }: { companyId: string }) {
  const [vans, setVans] = useState<{ id: string; name: string }[] | null>(null);
  const [stock, setStock] = useState<TechStock[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("inv_tech_stock", { p_company: companyId });
    if (error) { setErr(invError(error)); setVans([]); return; }
    const d = data as { vans: { id: string; name: string }[]; stock: TechStock[] };
    setVans(d.vans ?? []); setStock((d.stock ?? []).map((s) => ({ ...s, qty: Number(s.qty), min_qty: Number(s.min_qty) })));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => stock.filter((s) => `${s.name} ${s.sku}`.toLowerCase().includes(q.trim().toLowerCase())), [stock, q]);
  const low = stock.filter((s) => s.min_qty > 0 && s.qty <= s.min_qty).length;
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2400); };

  if (vans === null) return <div className={pageWrap}><div className="h-40 animate-pulse rounded-2xl bg-white" /></div>;
  return (
    <div className={`${pageWrap} mx-auto max-w-2xl`}>
      <div className="flex items-center gap-3">
        <LocIcon kind="van" size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{vans[0]?.name ?? "My Van"}</h1>
          <p className="text-[13.5px] text-slate-500">{vans.length ? `${stock.filter((s) => s.qty > 0).length} parts on board${low ? ` · ${low} running low` : ""}` : "No van assigned yet"}</p>
        </div>
      </div>
      {err && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      {!vans.length ? (
        <div className={`${card} mt-6 px-6 py-12 text-center`}>
          <p className="text-[16px] font-semibold text-[#0b1f3a]">Ask the office to assign you a van</p>
          <p className="mt-1 text-[14px] text-slate-500">Once you have one, you&apos;ll see your parts here and scan them when you use them.</p>
        </div>
      ) : (
        <>
          <Link prefetch={false} href="/dashboard/inventory/scan"
            className="mt-5 flex items-center justify-center gap-3 rounded-2xl bg-[radial-gradient(120%_140%_at_50%_120%,#2bb3a4_0%,#1a8f84_45%,#0f766e_100%)] px-5 py-5 text-[17px] font-semibold text-white shadow-[0_14px_32px_rgba(15,118,110,0.25)] transition-shadow hover:shadow-[0_18px_40px_rgba(15,118,110,0.32)] active:scale-[0.99]">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M16.5 8v8" /></svg>
            Scan a part I used
          </Link>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search my van"
            className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
          {list.length === 0 ? <p className={`${card} mt-3 px-4 py-10 text-center text-sm text-slate-500`}>{stock.length ? "Nothing matches." : "Your van is empty. The office restocks it with a transfer."}</p> : (
            <ul className={`${card} mt-3 divide-y divide-slate-100 overflow-hidden`}>
              {list.map((s) => {
                const st = s.qty <= 0 ? "out" : s.min_qty > 0 && s.qty <= s.min_qty ? "low" : "in";
                const m = STATUS_META[st];
                const key = `${s.item_id}-${s.location_id}`;
                return (
                  <li key={key}>
                    <button type="button" onClick={() => setOpen(open === key ? null : key)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f6fbfa]">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-[#f4f7fa]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {s.image_url ? <img src={s.image_url} alt="" className="h-full w-full object-cover" /> : <span className="text-slate-300">—</span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-[#0b1f3a]">{s.name}</span>
                        <span className="block truncate font-mono text-[12px] text-slate-400">{s.sku}</span>
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[14px] font-semibold tabular-nums ring-1 ${m.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{qtyFmt(s.qty)}</span>
                    </button>
                    {open === key && (
                      <div className="border-t border-slate-100 bg-[#fafbfc] px-4 py-4">
                        <TechUse companyId={companyId} itemId={s.item_id} itemName={s.name} unit={s.unit} vanId={s.location_id} available={s.qty}
                          onDone={(t) => { say(t); setOpen(null); load(); }} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <Toast text={toast} />
    </div>
  );
}
