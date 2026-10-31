"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PencilButton } from "@/components/catalog/DetailBits";
import { InvLocation, MOVE_LABEL, MoveKind, STATUS_META, qtyFmt, usd } from "@/lib/inventory";
import type { MoveRow } from "@/lib/inventory-server";
import { LocIcon, PageHead, card, fmtWhen, pageWrap } from "@/components/inventory/PageBits";

type Row = { item_id: string; qty: number; min_qty: number; items: { name: string; sku: string | null; unit: string | null; cost_price: number; image_url: string | null } | null };

// Lo que hay en una bodega o en la van de un técnico, con accesos para resurtir y contar
export default function LocationDetail({ location, locations, rows, moves, techName, canEdit }: {
  location: InvLocation & { is_active: boolean }; locations: InvLocation[]; rows: Row[]; moves: MoveRow[]; techName: string | null; canEdit: boolean;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => rows.filter((r) => (r.qty > 0 || r.min_qty > 0) && `${r.items?.name} ${r.items?.sku}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.items?.name ?? "").localeCompare(b.items?.name ?? "")), [rows, q]);
  const units = rows.reduce((s, r) => s + Math.max(0, r.qty), 0);
  const value = rows.reduce((s, r) => s + Math.max(0, r.qty) * Number(r.items?.cost_price ?? 0), 0);
  const low = rows.filter((r) => r.min_qty > 0 && r.qty <= r.min_qty).length;
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const btn = "inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[14px] font-medium text-slate-700 transition-colors hover:border-[#14a39a] hover:text-[#0f766e]";

  return (
    <div className={pageWrap}>
      <PageHead back="/dashboard/inventory/locations" title={location.name}
        subtitle={location.kind === "van" ? (techName ? `Van · ${techName}` : "Van · no technician assigned") : location.is_default ? "Main warehouse" : "Warehouse"}>
        <Link prefetch={false} href={`/dashboard/inventory/transfers/new?to=${location.id}`} className={btn}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg>
          {location.kind === "van" ? "Restock" : "Transfer in"}
        </Link>
        <Link prefetch={false} href={`/dashboard/inventory/counts/new?location=${location.id}`} className={btn}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5h6M9 3h6v4H9zM6 5H5v16h14V5h-1M9 13l2 2 4-4" /></svg>
          Count
        </Link>
        {canEdit && <PencilButton href={`/dashboard/inventory/locations/${location.id}/edit`} label="Edit location" />}
      </PageHead>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[["Units", qtyFmt(units)], ["Value", usd(value)], ["Low stock", String(low)]].map(([k, v]) => (
          <div key={k} className={`${card} p-3.5`}><p className="text-[12.5px] font-medium text-slate-500">{k}</p><p className="mt-1 truncate text-[20px] font-semibold tabular-nums text-[#0b1f3a]">{v}</p></div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-[#0b1f3a]"><LocIcon kind={location.kind} /> Stock here</p>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 w-44 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[14px] focus:border-[#0f766e] focus:bg-white focus:outline-none" />
          </div>
          {list.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">{rows.length ? "No items match." : "Nothing here yet. Use Restock / Transfer in to move parts into this location."}</p> : (
            <ul className="divide-y divide-slate-100">
              {list.map((r) => {
                const st = r.qty <= 0 ? "out" : r.min_qty > 0 && r.qty <= r.min_qty ? "low" : "in";
                const m = STATUS_META[st];
                return (
                  <li key={r.item_id}>
                    <Link prefetch={false} href={`/dashboard/inventory/${r.item_id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#f0faf7]">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-[#f4f7fa]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {r.items?.image_url ? <img src={r.items.image_url} alt="" className="h-full w-full object-cover" /> : <span className="text-slate-300">—</span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[#0b1f3a]">{r.items?.name}</span>
                        <span className="block truncate font-mono text-[12px] text-slate-400">{r.items?.sku}{r.min_qty > 0 ? <span className="font-sans"> · alert at {qtyFmt(r.min_qty)}</span> : null}</span>
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums ring-1 ${m.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{qtyFmt(r.qty)} <span className="font-medium opacity-75">{r.items?.unit ?? ""}</span></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${card} h-fit overflow-hidden`}>
          <p className="border-b border-slate-100 px-4 py-3 text-[15px] font-semibold text-[#0b1f3a]">Recent activity</p>
          {moves.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">No movements yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {moves.slice(0, 25).map((m) => {
                const inbound = m.to_location === location.id;
                return (
                  <li key={m.id} className="px-4 py-2.5">
                    <p className="truncate text-[14px] text-slate-800"><b className="font-semibold">{MOVE_LABEL[m.kind as MoveKind] ?? m.kind}</b>{" "}
                      <span className={`tabular-nums ${inbound ? "text-[#0f766e]" : "text-[#be123c]"}`}>{m.kind === "count" && m.qty === 0 ? "±0" : `${inbound ? "+" : "−"}${qtyFmt(m.qty)}`}</span> · {m.items?.name}</p>
                    <p className="truncate text-[12.5px] text-slate-500">{[m.kind === "transfer" || m.kind === "return" ? (inbound ? `from ${locName(m.from_location)}` : `to ${locName(m.to_location)}`) : m.reason, m.actor_name, fmtWhen(m.created_at)].filter(Boolean).join(" · ")}</p>
                  </li>
                );
              })}
            </ul>
          )}
          <Link prefetch={false} href={`/dashboard/inventory/movements?location=${location.id}`} className="block border-t border-slate-100 px-4 py-2.5 text-center text-[13.5px] font-medium text-[#0f766e] hover:bg-[#f0faf7]">See all movements</Link>
        </section>
      </div>
    </div>
  );
}
