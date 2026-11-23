"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import NewLocationModal from "@/components/inventory/NewLocationModal";
import { InvLocation, InvMember, qtyFmt } from "@/lib/inventory";
import { useTranslations } from "next-intl";
import { useInvTx } from "@/i18n/useInvTx";
import { EmptyBox, LocIcon, PageHead, pageWrap } from "@/components/inventory/PageBits";

type Loc = InvLocation & { is_active: boolean };
type Stat = { units: number; value: number; low: number; items: number };

// Bodegas y vans: cada van tiene a su técnico. Al tocar una, se ve qué trae.
export default function LocationsView({ locations, members, stats, canEdit }: { locations: Loc[]; members: InvMember[]; stats: Record<string, Stat>; canEdit: boolean }) {
  const t = useTranslations("invLocs");
  const usd = useInvTx().money;
  const name = (id: string | null) => members.find((m) => m.user_id === id)?.full_name ?? null;
  const groups: [string, Loc[]][] = [["warehouses", locations.filter((l) => l.kind === "warehouse")], ["vans", locations.filter((l) => l.kind === "van")]];
  const vans = groups[1][1];
  // Paso 6.12: "New" abre la ventana Van / Warehouse (también desde el "+" del menú: ?new=1)
  const [newOpen, setNewOpen] = useState(false);
  const sp = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (sp.get("new") === "1") { if (canEdit) setNewOpen(true); router.replace("/dashboard/inventory/locations", { scroll: false }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);
  const btn = "inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[14px] font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e]";
  const newBtn = (label?: string) => (
    <button type="button" onClick={() => setNewOpen(true)} className="group/n inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[15px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59]">
      <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{label ?? t("new")}
    </button>
  );
  return (
    <div className={pageWrap}>
      <PageHead title={t("title")} subtitle={t("subtitle")}>
        <Link prefetch={false} href="/dashboard/inventory/transfers/new" className={btn}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg>{t("transfer")}
        </Link>
        <Link prefetch={false} href="/dashboard/inventory/counts/new" className={btn}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5h6M9 3h6v4H9zM6 5H5v16h14V5h-1M9 13l2 2 4-4" /></svg>{t("count")}
        </Link>
        {canEdit && newBtn()}
      </PageHead>
      {groups.map(([title, list]) => (
        <section key={title} className="mt-6">
          <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-slate-400">{t(title)}</h2>
          {list.length === 0 ? (
            title === "vans" ? (
              <EmptyBox title={t("noVans")} text={t("noVansText")}>
                {canEdit && newBtn(t("newVan"))}
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
                          {l.is_default && <span className="shrink-0 rounded-full bg-[#e9f7f4] px-2 py-0.5 text-[10.5px] font-semibold text-[#0f766e]">{t("main")}</span>}
                          {!l.is_active && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">{t("inactive")}</span>}
                        </p>
                        <p className="truncate text-[13px] text-slate-500">{l.kind === "van" ? (tech ? t("techX", { name: tech }) : t("noTech")) : t("warehouse")}</p>
                      </div>
                      {s.low > 0 && <span className="shrink-0 rounded-full bg-[#fff7e6] px-2 py-0.5 text-[12px] font-semibold text-[#b45309] ring-1 ring-[#fcdca4]">{t("nLow", { n: s.low })}</span>}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                      {[[t("items"), String(s.items)], [t("units"), qtyFmt(s.units)], [t("value"), usd(s.value)]].map(([k, v]) => (
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
      {vans.some((v) => (stats[v.id]?.low ?? 0) > 0) && (
        <section className="mt-6 rounded-2xl border border-[#fcdca4] bg-[#fffaf0] p-4">
          <p className="text-[14.5px] font-semibold text-[#0b1f3a]">{t("restockTitle")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {vans.filter((v) => (stats[v.id]?.low ?? 0) > 0).map((v) => (
              <Link key={v.id} prefetch={false} href={`/dashboard/inventory/transfers/new?to=${v.id}&restock=1`}
                className="inline-flex items-center gap-2 rounded-lg border border-[#f6c27a] bg-white px-3 py-1.5 text-[13.5px] font-semibold text-[#b45309] transition-all hover:-translate-y-0.5 hover:border-[#e8713a]">
                {t("restockX", { name: v.name, n: stats[v.id]?.low ?? 0 })}
              </Link>
            ))}
          </div>
        </section>
      )}
      {vans.length > 0 && <p className="mt-6 text-[13px] text-slate-500">{t("tip")}</p>}
      {canEdit && (
        <button type="button" onClick={() => setNewOpen(true)} aria-label={t("newLoc")}
          className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-lg shadow-[#0f766e]/30 active:scale-95 lg:hidden">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
        </button>
      )}
      <NewLocationModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
