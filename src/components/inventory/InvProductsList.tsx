"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useInvTx } from "@/i18n/useInvTx";
import SelectMenu from "@/components/ui/SelectMenu";
import { InvItem, InvLocation, InvPhoto, InvStock, STATUS_META, StockStatus, qtyFmt, statusOf } from "@/lib/inventory";
import { LocArt } from "@/components/inventory/InvArt";

// =====================================================================
// Paso 6.12c · Todos los productos al final del Dashboard de Inventario (como la lista de Items):
// buscar, filtrar por estado y por ubicación, ver en qué almacén/van está cada uno y abrirlo.
// =====================================================================
const INV = "/dashboard/inventory";
const PAGE = 25;

export default function InvProductsList({ items, stock, locations, photos }: { items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; photos: InvPhoto[] }) {
  const t = useTranslations("invProducts");
  const ix = useInvTx();
  const [q, setQ] = useState("");
  const [st, setSt] = useState<"all" | StockStatus>("all");
  const [where, setWhere] = useState("all");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const thumbs = new Map<string, string>();
    photos.forEach((p) => { if (!thumbs.has(p.item_id)) thumbs.set(p.item_id, p.url); });
    const loc = new Map(locations.map((l) => [l.id, l]));
    return items.map((it) => {
      const r = stock.filter((s) => s.item_id === it.id && loc.has(s.location_id));
      const total = r.reduce((a, s) => a + s.qty, 0);
      return {
        it, total, status: statusOf(r), value: Math.max(0, total) * it.cost_price, thumb: thumbs.get(it.id) ?? it.image_url,
        places: r.filter((s) => s.qty > 0 || s.min_qty > 0).map((s) => ({ l: loc.get(s.location_id)!, qty: s.qty, low: s.min_qty > 0 && s.qty <= s.min_qty }))
          .sort((a, b) => Number(b.l.kind === "warehouse") - Number(a.l.kind === "warehouse") || b.qty - a.qty),
      };
    });
  }, [items, stock, locations, photos]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => (st === "all" || r.status === st) && (where === "all" || r.places.some((p) => p.l.id === where))
      && (!term || `${r.it.name} ${r.it.sku ?? ""}`.toLowerCase().includes(term)))
      .sort((a, b) => (a.status === b.status ? a.it.name.localeCompare(b.it.name) : ({ out: 0, low: 1, in: 2 }[a.status] - { out: 0, low: 1, in: 2 }[b.status])));
  }, [rows, q, st, where]);
  const counts = { all: rows.length, low: rows.filter((r) => r.status === "low").length, out: rows.filter((r) => r.status === "out").length, in: rows.filter((r) => r.status === "in").length };
  const chips: ("all" | StockStatus)[] = ["all", "low", "out", "in"];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 lg:px-5">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-tight text-[#0b1f3a]">{t("title")}</h2>
          <p className="text-[13px] text-slate-500">{t("subtitle", { n: rows.length })}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link prefetch={false} href={`${INV}/scan`} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-[14px] font-medium text-[#0f766e] transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:bg-[#e9f7f4]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M16.5 8v8" /></svg>{t("scan")}
          </Link>
          <Link prefetch={false} href={`${INV}/new`} className="group/n inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0f766e] px-3.5 text-[14px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59]">
            <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("new")}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 lg:px-5">
        <div className="relative min-w-0 flex-1 basis-56">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
          <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder={t("search")} aria-label={t("search")}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
        </div>
        <div className="w-full sm:w-56">
          <SelectMenu value={where} ariaLabel={t("where")} onChange={(v) => { setWhere(v); setLimit(PAGE); }}
            options={[{ value: "all", label: t("everywhere") }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} />
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 text-[14px] [scrollbar-width:none]">
          {chips.map((k) => (
            <button key={k} type="button" onClick={() => { setSt(k); setLimit(PAGE); }} aria-pressed={st === k}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors ${st === k ? "bg-[#e9f7f4] font-semibold text-[#0b5e57]" : "text-slate-600 hover:text-[#0b1f3a]"}`}>
              {k === "all" ? t("all") : ix.status(k)}<span className={`rounded-full px-1.5 text-[11px] font-semibold ${k === "out" && counts.out ? "bg-[#fff1f2] text-[#be123c]" : k === "low" && counts.low ? "bg-[#fff7e6] text-[#b45309]" : "bg-slate-100 text-slate-500"}`}>{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">{rows.length ? t("noMatch") : t("empty")}</p>
      ) : (
        <>
          {/* Computadora: tabla */}
          <table className="hidden w-full text-[14px] md:table">
            <thead><tr className="border-y border-slate-100 bg-[#fafbfc] text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2.5">{t("product")}</th><th className="px-3 py-2.5">{t("whereCol")}</th><th className="px-3 py-2.5 text-right">{t("onHand")}</th><th className="px-3 py-2.5">{t("status")}</th><th className="px-5 py-2.5 text-right">{t("value")}</th>
            </tr></thead>
            <tbody>
              {shown.slice(0, limit).map((r) => {
                const m = { ...STATUS_META[r.status], label: ix.status(r.status) };
                return (
                  <tr key={r.it.id} className="group border-b border-slate-100 transition-colors last:border-0 hover:bg-[#f6fbfa]">
                    <td className="px-5 py-2.5">
                      <Link prefetch={false} href={`${INV}/${r.it.id}`} className="flex items-center gap-3">
                        <Thumb src={r.thumb} />
                        <span className="min-w-0"><span className={`block truncate font-medium text-[#0b1f3a] group-hover:text-[#0f766e] ${r.it.is_active ? "" : "line-through decoration-slate-300"}`}>{r.it.name}</span>
                          <span className="block truncate font-mono text-[12px] text-slate-400">{r.it.sku}</span></span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5"><Places places={r.places} /></td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#0b1f3a]">{qtyFmt(r.total)} <span className="font-normal text-slate-400">{r.it.unit ?? ""}</span></td>
                    <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ${m.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{m.label}</span></td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-slate-700">{ix.money(r.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Celular: renglones */}
          <ul className="divide-y divide-slate-100 border-t border-slate-100 md:hidden">
            {shown.slice(0, limit).map((r) => {
              const m = { ...STATUS_META[r.status], label: ix.status(r.status) };
              return (
                <li key={r.it.id}>
                  <Link prefetch={false} href={`${INV}/${r.it.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-[#f0faf7]">
                    <Thumb src={r.thumb} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[#0b1f3a]">{r.it.name}</span>
                      <span className="block truncate text-[12px] text-slate-500">{r.places.slice(0, 2).map((p) => `${p.l.name} ${qtyFmt(p.qty)}`).join(" · ") || r.it.sku}</span>
                    </span>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums ring-1 ${m.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{qtyFmt(r.total)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {shown.length > limit && (
            <div className="border-t border-slate-100 p-3 text-center">
              <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="whitespace-nowrap rounded-lg px-4 py-2 text-[14px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">{t("more", { n: shown.length - limit })}</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Thumb({ src }: { src: string | null }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-[#f4f7fa]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9" /></svg>}
    </span>
  );
}
function Places({ places }: { places: { l: InvLocation; qty: number; low: boolean }[] }) {
  if (!places.length) return <span className="text-slate-300">—</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {places.slice(0, 3).map((p) => (
        <span key={p.l.id} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full py-0.5 pl-0.5 pr-2 text-[12px] ring-1 ${p.low ? "bg-[#fff7e6] text-[#b45309] ring-[#fcdca4]" : "bg-white text-slate-600 ring-slate-200"}`}>
          <LocArt kind={p.l.kind} size={18} />{p.l.name} <b className="tabular-nums">{qtyFmt(p.qty)}</b>
        </span>
      ))}
      {places.length > 3 && <span className="text-[12px] text-slate-400">+{places.length - 3}</span>}
    </span>
  );
}
