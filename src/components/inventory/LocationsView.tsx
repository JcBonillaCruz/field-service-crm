"use client";

import Link from "next/link";
import { InvLocation, InvMember, qtyFmt, usd } from "@/lib/inventory";
import { EmptyBox, Fab, LocIcon, NewButton, PageHead, pageWrap } from "@/components/inventory/PageBits";

type Loc = InvLocation & { is_active: boolean };
type Stat = { units: number; value: number; low: number; items: number };

// Bodegas y vans: cada van tiene a su técnico. Al tocar una, se ve qué trae.
export default function LocationsView({ locations, members, stats, canEdit }: { locations: Loc[]; members: InvMember[]; stats: Record<string, Stat>; canEdit: boolean }) {
  const name = (id: string | null) => members.find((m) => m.user_id === id)?.full_name ?? null;
  const groups: [string, Loc[]][] = [["Warehouses", locations.filter((l) => l.kind === "warehouse")], ["Vans", locations.filter((l) => l.kind === "van")]];
  const vans = groups[1][1];
  return (
    <div className={pageWrap}>
      <PageHead title="Locations & Vans" subtitle="Where your stock lives. Give each technician a van and restock it from the warehouse.">
        {canEdit && <NewButton href="/dashboard/inventory/locations/new" />}
      </PageHead>
      {groups.map(([title, list]) => (
        <section key={title} className="mt-6">
          <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
          {list.length === 0 ? (
            title === "Vans" ? (
              <EmptyBox title="No vans yet" text="Create a van for each technician. They will see only their van, scan parts when they use them, and you restock them with Transfers.">
                {canEdit && <NewButton href="/dashboard/inventory/locations/new" label="New van" />}
              </EmptyBox>
            ) : null
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((l) => {
                const s = stats[l.id] ?? { units: 0, value: 0, low: 0, items: 0 };
                const tech = name(l.assigned_user_id);
                return (
                  <Link prefetch={false} key={l.id} href={`/dashboard/inventory/locations/${l.id}`}
                    className={`group rounded-2xl border bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-[0_12px_28px_rgba(15,40,60,0.08)] ${l.is_active ? "border-slate-200" : "border-dashed border-slate-300 opacity-70"}`}>
                    <div className="flex items-start gap-3">
                      <LocIcon kind={l.kind} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-[16px] font-semibold text-[#0b1f3a] group-hover:text-[#0f766e]">
                          <span className="truncate">{l.name}</span>
                          {l.is_default && <span className="shrink-0 rounded-full bg-[#e9f7f4] px-2 py-0.5 text-[10.5px] font-semibold text-[#0f766e]">Main</span>}
                          {!l.is_active && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">Inactive</span>}
                        </p>
                        <p className="truncate text-[13px] text-slate-500">{l.kind === "van" ? (tech ? `Technician: ${tech}` : "No technician assigned") : "Warehouse"}</p>
                      </div>
                      {s.low > 0 && <span className="shrink-0 rounded-full bg-[#fff7e6] px-2 py-0.5 text-[12px] font-semibold text-[#b45309] ring-1 ring-[#fcdca4]">{s.low} low</span>}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                      {[["Items", String(s.items)], ["Units", qtyFmt(s.units)], ["Value", usd(s.value)]].map(([k, v]) => (
                        <div key={k}><p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{k}</p><p className="truncate text-[15px] font-semibold tabular-nums text-[#0b1f3a]">{v}</p></div>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ))}
      {vans.length > 0 && <p className="mt-6 text-[13px] text-slate-500">Tip: open a van to restock it or count it. Missing parts found in a count are recorded under that van&apos;s technician.</p>}
      {canEdit && <Fab href="/dashboard/inventory/locations/new" label="New location" />}
    </div>
  );
}
