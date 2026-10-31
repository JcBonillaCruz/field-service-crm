"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SelectMenu from "@/components/ui/SelectMenu";
import { InvLocation, qtyFmt, usd } from "@/lib/inventory";
import type { MoveRow } from "@/lib/inventory-server";
import { PageHead, card, pageWrap } from "@/components/inventory/PageBits";

const DAYS = [{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }, { value: "365", label: "Last 12 months" }];
type Agg = { name: string; units: number; value: number };

// Reportes: cuánto usó cada técnico, cuánto le resurtieron y cuánto le faltó en los conteos
export default function ReportsView({ locations, moves, days }: { locations: InvLocation[]; moves: MoveRow[]; days: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const r = useMemo(() => {
    const add = (map: Map<string, Agg>, key: string, units: number, cost: number | null) => {
      const a = map.get(key) ?? { name: key, units: 0, value: 0 };
      a.units += units; a.value += units * (cost ?? 0); map.set(key, a);
    };
    const used = new Map<string, Agg>(), restocked = new Map<string, Agg>(), missing = new Map<string, Agg>(), items = new Map<string, Agg>();
    const vanTech = new Map(locations.filter((l) => l.kind === "van").map((l) => [l.id, l.name]));
    for (const m of moves) {
      if (m.kind === "use") { add(used, m.responsible_name || m.actor_name || "Unknown", m.qty, m.unit_cost); add(items, m.items?.name ?? "Item", m.qty, m.unit_cost); }
      if (m.kind === "transfer" && m.to_location && vanTech.has(m.to_location)) add(restocked, vanTech.get(m.to_location)!, m.qty, m.unit_cost);
      if (m.kind === "count" && m.reason === "Missing") add(missing, m.responsible_name || vanTech.get(m.from_location ?? "") || "Warehouse", m.qty, m.unit_cost);
    }
    const sort = (m: Map<string, Agg>) => Array.from(m.values()).sort((a, b) => b.value - a.value || b.units - a.units);
    return { used: sort(used), restocked: sort(restocked), missing: sort(missing), items: sort(items).slice(0, 10) };
  }, [moves, locations]);
  const totals = (l: Agg[]) => l.reduce((s, a) => ({ units: s.units + a.units, value: s.value + a.value }), { units: 0, value: 0 });
  const tu = totals(r.used), tm = totals(r.missing), tr = totals(r.restocked);

  return (
    <div className={pageWrap}>
      <PageHead title="Reports" subtitle="What each technician used, what you restocked and what went missing.">
        <div className="w-44"><SelectMenu ariaLabel="Period" value={String(days)} onChange={(v) => router.replace(`${pathname}?days=${v}`, { scroll: false })} options={DAYS} /></div>
      </PageHead>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[["Used on jobs", tu, "text-[#0b1f3a]"], ["Restocked to vans", tr, "text-[#0b1f3a]"], ["Missing in counts", tm, tm.units > 0 ? "text-[#be123c]" : "text-[#0b1f3a]"]].map(([k, t, c]) => (
          <div key={k as string} className={`${card} p-4`}>
            <p className="text-[13px] font-medium text-slate-500">{k as string}</p>
            <p className={`mt-1 text-[24px] font-semibold tabular-nums ${c}`}>{usd((t as { value: number }).value)}</p>
            <p className="text-[12.5px] text-slate-500">{qtyFmt((t as { units: number }).units)} units</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Table title="Used by technician" note="Parts scanned as used on a job." rows={r.used} empty="No parts used in this period." />
        <Table title="Missing by technician" note="From physical counts: parts that weren't scanned and aren't in the van." rows={r.missing} danger empty="No missing parts. Count your vans to check." />
        <Table title="Restocked by van" note="Parts transferred into each van." rows={r.restocked} empty="No restocks in this period." />
        <Table title="Most used parts" note="Top 10 by value." rows={r.items} empty="No parts used in this period." />
      </div>
      <p className="mt-6 text-[13px] text-slate-500">How to read it: if a van gets restocked much more than its technician scans as used, count that van. The difference shows up as missing. <Link prefetch={false} href="/dashboard/inventory/counts/new" className="font-medium text-[#0f766e] hover:underline">Start a count</Link></p>
    </div>
  );
}

function Table({ title, note, rows, empty, danger }: { title: string; note: string; rows: Agg[]; empty: string; danger?: boolean }) {
  const max = Math.max(1, ...rows.map((a) => a.value || a.units));
  return (
    <section className={`${card} overflow-hidden`}>
      <div className="border-b border-slate-100 px-4 py-3"><p className="text-[15px] font-semibold text-[#0b1f3a]">{title}</p><p className="text-[12.5px] text-slate-500">{note}</p></div>
      {rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">{empty}</p> : (
        <ul className="divide-y divide-slate-100">
          {rows.map((a) => (
            <li key={a.name} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-3 text-[14px]">
                <span className="truncate font-medium text-slate-800">{a.name}</span>
                <span className="shrink-0 tabular-nums text-slate-600">{qtyFmt(a.units)} · <b className={danger ? "text-[#be123c]" : "text-[#0b1f3a]"}>{usd(a.value)}</b></span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${danger ? "bg-[#e11d48]" : "bg-[#14a39a]"}`} style={{ width: `${Math.max(4, ((a.value || a.units) / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
