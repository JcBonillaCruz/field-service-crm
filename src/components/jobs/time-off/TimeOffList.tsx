"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
import SelectMenu from "@/components/ui/SelectMenu";
import { Toast } from "@/components/sales/SalesBits";
import { TechDot } from "@/components/jobs/EventBar";
import { OffArt } from "@/components/jobs/time-off/OffTodayStrip";
import { TeamMember, addDays, dayStart, receivesJobs } from "@/lib/jobs";
import { OFF_COLOR, OFF_KINDS, TimeOff, lastDay, offHours } from "@/lib/time-off";

// =====================================================================
// Paso 6.13b · Jobs → Time off (Días libres): hoy · próximos · pasados, por persona y motivo
// =====================================================================
type Tab = "today" | "upcoming" | "past";

export default function TimeOffList({ team, rows, needsSql, saved }: { team: TeamMember[]; rows: TimeOff[]; needsSql: boolean; saved: string }) {
  const t = useTranslations("offDash");
  const tk = useTranslations("sched");
  const tag = intlTag(useLocale());
  const [tab, setTab] = useState<Tab>("today");
  const [person, setPerson] = useState("all");
  const [kind, setKind] = useState("all");
  const [toast, setToast] = useState(saved);
  useEffect(() => { if (toast) { const tm = setTimeout(() => setToast(""), 2800); return () => clearTimeout(tm); } }, [toast]);

  const now = new Date(), d0 = dayStart(now), d1 = addDays(d0, 1);
  const pick = (o: TimeOff) => (person === "all" || o.user_id === person) && (kind === "all" || o.kind === kind);
  const lists = useMemo(() => ({
    today: rows.filter((o) => new Date(o.starts_at) < d1 && new Date(o.ends_at) > d0),
    upcoming: rows.filter((o) => new Date(o.starts_at) >= d1),
    past: rows.filter((o) => new Date(o.ends_at) <= d0).reverse(),
  }), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = lists[tab].filter(pick);
  const who = (id: string) => team.find((m) => m.user_id === id);
  const day = (d: Date) => d.toLocaleDateString(tag, { weekday: "short", month: "short", day: "numeric" });
  const when = (o: TimeOff) => {
    const a = dayStart(new Date(o.starts_at)), b = lastDay(o), h = offHours(o, tag);
    if (h) return `${day(a)} · ${h}`;
    const n = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
    return a.getTime() === b.getTime() ? `${day(a)} · ${t("allDay")}` : `${day(a)} – ${day(b)} · ${t("nDays", { n })}`;
  };
  const people = [...team].sort((a, b) => Number(receivesJobs(b)) - Number(receivesJobs(a)) || a.full_name.localeCompare(b.full_name));

  return (
    <div className="min-h-full bg-[#f4f6f8] px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <OffArt size={44} />
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">{t("pageTitle")}</h1>
            <p className="text-[13.5px] text-slate-500">{t("pageSub")}</p>
          </div>
        </div>
        <Link prefetch={false} href="/dashboard/jobs/time-off/new"
          className="group/n inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[15px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-all hover:-translate-y-0.5 hover:bg-[#0c5f59]">
          <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("add")}
        </Link>
      </div>
      {needsSql && <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-[14px] text-amber-800 ring-1 ring-amber-200">{t("eSql")}</p>}

      <div className="mt-5 border-b border-slate-200">
        <div role="tablist" className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["today", "upcoming", "past"] as Tab[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`relative shrink-0 whitespace-nowrap py-3 text-[15px] transition-colors ${tab === k ? "font-semibold text-[#0f766e]" : "text-slate-600 hover:text-[#0b1f3a]"}`}>
              {t(`tab.${k}`)}<span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11.5px] font-semibold text-slate-600">{lists[k].filter(pick).length}</span>
              <span className={`absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e] transition-transform duration-200 ${tab === k ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="w-full sm:w-[240px]"><SelectMenu ariaLabel={t("person")} value={person} onChange={setPerson} options={[{ value: "all", label: t("everyone") }, ...people.map((m) => ({ value: m.user_id, label: m.full_name }))]} /></div>
        <div className="w-full sm:w-[220px]"><SelectMenu ariaLabel={t("reason")} value={kind} onChange={setKind} options={[{ value: "all", label: t("allReasons") }, ...OFF_KINDS.map((k) => ({ value: k, label: tk(`offKind.${k}` as never) }))]} /></div>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {list.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[15px] font-semibold text-[#0b1f3a]">{tab === "today" ? t("nobody") : tab === "upcoming" ? t("noneUpcoming") : t("nonePast")}</p>
            <Link prefetch={false} href="/dashboard/jobs/time-off/new" className="mt-3 inline-block text-[14px] font-semibold text-[#0f766e] hover:underline">{t("add")}</Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((o) => {
              const m = who(o.user_id);
              const live = new Date(o.starts_at) <= now && new Date(o.ends_at) > now;
              return (
                <li key={o.id}>
                  <Link prefetch={false} href={`/dashboard/jobs/time-off/${o.id}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#f6fbfa] lg:px-5">
                    <span className="relative shrink-0 transition-transform duration-200 group-hover:scale-105">
                      {m ? <TechDot t={{ ...m, name: m.full_name }} size={40} ring={false} /> : <span className="block h-10 w-10 rounded-full bg-slate-200" />}
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white" style={{ background: OFF_COLOR[o.kind] }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-[#0b1f3a]">{m?.full_name ?? t("former")}</span>
                      <span className="block truncate text-[13px] text-slate-500">{when(o)}{o.note ? ` · “${o.note}”` : ""}</span>
                    </span>
                    {live && tab === "today" && <span className="hidden shrink-0 rounded-full bg-[#fff7ed] px-2.5 py-0.5 text-[12px] font-semibold text-[#c2410c] ring-1 ring-[#fed7aa] sm:inline">{t("now")}</span>}
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-semibold" style={{ background: `${OFF_COLOR[o.kind]}18`, color: OFF_COLOR[o.kind] }}>{tk(`offKind.${o.kind}` as never)}</span>
                    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#0f766e]" fill="currentColor"><path d="M7.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L11.6 10 7.3 5.7a1 1 0 0 1 0-1.4z" /></svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Toast text={toast} />
    </div>
  );
}
