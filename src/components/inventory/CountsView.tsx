"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InvItem, InvStock } from "@/lib/inventory";
import CountSheetModal, { SheetIcon } from "@/components/inventory/CountSheetModal";
import { InvLocation, qtyFmt } from "@/lib/inventory";
import { useTranslations } from "next-intl";
import { useInvTx } from "@/i18n/useInvTx";
import type { MoveRow } from "@/lib/inventory-server";
import { EmptyBox, Fab, NewButton, PageHead, card, pageWrap, useFmt } from "@/components/inventory/PageBits";

// Conteos físicos hechos (uno por ubicación y fecha) con lo que faltó y quién es responsable
export default function CountsView({ locations, moves, reversed = {}, items = [], stock = [], company = "" }: {
  locations: InvLocation[]; moves: MoveRow[];
  reversed?: Record<string, { by: string | null; reason: string }>; items?: InvItem[]; stock?: InvStock[]; company?: string; // Paso 6.12d
}) {
  const [sheet, setSheet] = useState(false);
  const t = useTranslations("invCounts");
  const usd = useInvTx().money;
  const { fmtWhen } = useFmt();
  const name = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const groups = useMemo(() => {
    const map = new Map<string, MoveRow[]>();
    moves.forEach((m) => { const k = m.batch_id ?? m.id; map.set(k, [...(map.get(k) ?? []), m]); });
    return Array.from(map.values()).map((g) => {
      const missing = g.filter((m) => m.reason === "Missing");
      return {
        id: g[0].batch_id ?? g[0].id, at: g[0].created_at, by: g[0].actor_name, loc: name(g[0].from_location ?? g[0].to_location), items: g.length,
        missing: missing.reduce((s, m) => s + m.qty, 0), missingCost: missing.reduce((s, m) => s + m.qty * (m.unit_cost ?? 0), 0),
        extra: g.filter((m) => m.reason === "Extra found").reduce((s, m) => s + m.qty, 0), resp: missing.find((m) => m.responsible_name)?.responsible_name ?? null,
        lines: missing.map((m) => `${qtyFmt(m.qty)} × ${m.items?.name ?? t("item")}`),
      };
    });
  }, [moves]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={pageWrap}>
      <PageHead title={t("title")} subtitle={t("subtitle")}>
        {items.length > 0 && (
          <button type="button" onClick={() => setSheet(true)} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 text-[14px] font-medium text-[#0f766e] transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:bg-[#e9f7f4]"><SheetIcon />{t("sheet")}</button>
        )}
        <NewButton href="/dashboard/inventory/counts/new" />
      </PageHead>
      {groups.length === 0 ? (
        <EmptyBox title={t("none")} text={t("noneText")}>
          <NewButton href="/dashboard/inventory/counts/new" label={t("new")} />
        </EmptyBox>
      ) : (
        <ul className="mt-5 space-y-3">
          {groups.map((g) => (
            <li key={g.id} className={`${card} group relative p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-[0_12px_28px_rgba(15,40,60,0.08)] ${reversed[g.id] ? "opacity-75" : ""}`}>
              <Link prefetch={false} href={`/dashboard/inventory/counts/${g.id}`} aria-label={g.loc} className="absolute inset-0 rounded-2xl" />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-[#0b1f3a]">{g.loc}</p>
                  <p className="text-[12.5px] text-slate-500">{[t("nCounted", { n: g.items }), g.by, fmtWhen(g.at)].filter(Boolean).join(" · ")}</p>
                </div>
                {reversed[g.id]
                  ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200">{t("reversed")}</span>
                  : g.missing > 0
                  ? <span className="rounded-full bg-[#fff1f2] px-2.5 py-1 text-[13px] font-semibold text-[#be123c] ring-1 ring-[#fecdd3]">{t("missing", { n: qtyFmt(g.missing), x: usd(g.missingCost) })}</span>
                  : <span className="rounded-full bg-[#e7f6f1] px-2.5 py-1 text-[13px] font-semibold text-[#0f766e] ring-1 ring-[#bfe6da]">{t("matched")}</span>}
              </div>
              {g.missing > 0 && <p className="mt-2 text-[14px] text-slate-600">{g.resp ? <b className="font-semibold">{g.resp}: </b> : null}{g.lines.join(" · ")}</p>}
              {g.extra > 0 && <p className="mt-1 text-[13px] text-[#0f766e]">{t("extra", { n: qtyFmt(g.extra) })}</p>}
              {reversed[g.id] && <p className="mt-1 text-[13px] text-slate-500">{t("reversedWhy", { name: reversed[g.id].by ?? "—", reason: reversed[g.id].reason })}</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-[13px] text-slate-500">{t.rich("reportsNote", { a: (c) => <Link prefetch={false} href="/dashboard/inventory/reports" className="font-medium text-[#0f766e] hover:underline">{c}</Link> })}</p>
      <Fab href="/dashboard/inventory/counts/new" label={t("new")} />
      <CountSheetModal open={sheet} onClose={() => setSheet(false)} items={items} stock={stock} locations={locations} company={company} />
    </div>
  );
}
