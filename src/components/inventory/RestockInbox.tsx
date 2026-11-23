"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { qtyFmt } from "@/lib/inventory";
import { VanArt } from "@/components/inventory/InvArt";

// =====================================================================
// Paso 6.12f · Solicitudes de resurtido de los técnicos (Dashboard de inventario)
// =====================================================================
export type RestockRow = {
  id: string; location_id: string; requested_by_name: string | null; items: { item_id: string; name: string; qty: number }[]; note: string | null; created_at: string; van: string;
};

export default function RestockInbox({ rows, userName }: { rows: RestockRow[]; userName: string }) {
  const t = useTranslations("restock");
  const router = useRouter();
  const es = useLocale().startsWith("es");
  const [gone, setGone] = useState<string[]>([]);
  const list = rows.filter((r) => !gone.includes(r.id));
  if (!list.length) return null;
  const day = (iso: string) => new Date(iso).toLocaleString(es ? "es-US" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  async function close(r: RestockRow, status: "done" | "cancelled") {
    setGone((g) => [...g, r.id]);
    const { error } = await createClient().from("inventory_restock_requests").update({ status, handled_by_name: userName || null, handled_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { setGone((g) => g.filter((x) => x !== r.id)); return; }
    if (status === "done") fetch("/api/inventory/restock-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, done: true }) }).catch(() => undefined);
    router.refresh();
  }
  return (
    <section id="requests" className="mt-5 scroll-mt-20 overflow-hidden rounded-2xl border border-amber-200 bg-white">
      <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50/60 px-5 py-3.5">
        <VanArt size={36} />
        <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[#0b1f3a]">{t("inbox")}</h2>
        <span className="shrink-0 rounded-full bg-amber-500 px-2.5 py-0.5 text-[13px] font-bold tabular-nums text-white">{list.length}</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {list.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-[#0b1f3a]">{r.van}<span className="font-normal text-slate-500"> · {r.requested_by_name ?? "—"} · {day(r.created_at)}</span></p>
              <p className="mt-0.5 line-clamp-2 text-[13.5px] text-slate-600">{r.items.map((i) => `${i.name} ×${qtyFmt(Number(i.qty))}`).join(" · ")}</p>
              {r.note && <p className="mt-0.5 truncate text-[13px] italic text-slate-500">“{r.note}”</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link prefetch={false} href={`/dashboard/inventory/transfers/new?to=${r.location_id}&restock=1`}
                className="inline-flex h-10 items-center whitespace-nowrap rounded-lg bg-[#0f766e] px-3.5 text-[14px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#0c5f59]">{t("refill")}</Link>
              <button type="button" onClick={() => close(r, "done")} className="inline-flex h-10 items-center whitespace-nowrap rounded-lg border border-slate-200 px-3.5 text-[14px] font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e]">{t("done")}</button>
              <button type="button" onClick={() => close(r, "cancelled")} aria-label={t("dismiss")} className="group/x flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
                <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
