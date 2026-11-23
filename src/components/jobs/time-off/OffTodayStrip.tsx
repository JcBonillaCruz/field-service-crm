"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { intlTag } from "@/i18n/config";
import { TechDot } from "@/components/jobs/EventBar";
import { TeamMember, addDays, dayStart } from "@/lib/jobs";
import { OFF_COLOR, OFF_SELECT, TimeOff, lastDay, offHours } from "@/lib/time-off";

// =====================================================================
// Paso 6.13b · En los dashboards (Inicio y Jobs): quién está fuera hoy (día libre, permiso, vacaciones…)
// y quién se va en los próximos 7 días. Botón para asignar un día libre o permiso.
// =====================================================================
export default function OffTodayStrip({ companyId, team, className = "" }: { companyId: string; team: TeamMember[]; className?: string }) {
  const t = useTranslations("offDash");
  const tk = useTranslations("sched");
  const tag = intlTag(useLocale());
  const [rows, setRows] = useState<TimeOff[] | null>(null);
  const load = useCallback(async () => {
    const d0 = dayStart(new Date());
    const { data, error } = await createClient().from("team_time_off").select(OFF_SELECT).eq("company_id", companyId)
      .gt("ends_at", d0.toISOString()).lt("starts_at", addDays(d0, 8).toISOString()).order("starts_at").limit(300);
    setRows(error ? [] : ((data ?? []) as TimeOff[]));
  }, [companyId]);
  useEffect(() => {
    load();
    const ch = createClient().channel(`off-dash-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_time_off", filter: `company_id=eq.${companyId}` }, load).subscribe();
    return () => { createClient().removeChannel(ch); };
  }, [companyId, load]);
  if (rows === null) return null;

  const now = new Date(), d0 = dayStart(now), d1 = addDays(d0, 1);
  const today = rows.filter((o) => new Date(o.starts_at) < d1 && new Date(o.ends_at) > d0);
  const soon = rows.filter((o) => new Date(o.starts_at) >= d1).slice(0, 6);
  const who = (id: string) => team.find((m) => m.user_id === id);
  const day = (d: Date) => d.toLocaleDateString(tag, { weekday: "short", month: "short", day: "numeric" });
  const span = (o: TimeOff) => {
    const h = offHours(o, tag);
    if (h) return h;
    const a = dayStart(new Date(o.starts_at)), b = lastDay(o);
    return a.getTime() === b.getTime() ? t("allDay") : t("until", { d: day(b) });
  };
  const nowOff = (o: TimeOff) => new Date(o.starts_at) <= now && new Date(o.ends_at) > now;

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white ${className}`} aria-label={t("title")}>
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4 lg:px-5">
        <OffArt />
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{t("title")}</h2>
          <p className="text-[12.5px] text-slate-500">{today.length ? t("nOut", { n: new Set(today.map((o) => o.user_id)).size }) : t("allIn")}</p>
        </div>
        <Link prefetch={false} href="/dashboard/jobs/time-off" className="text-[13.5px] font-medium text-[#0f766e] hover:underline">{t("seeAll")}</Link>
        <Link prefetch={false} href="/dashboard/jobs/time-off/new"
          className="group/n inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 text-[13.5px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#0c5f59]">
          <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("add")}
        </Link>
      </div>
      <div className="grid gap-4 px-4 pb-4 pt-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:px-5">
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">{t("today")}</p>
          {!today.length ? <p className="rounded-xl bg-[#f3fbf8] px-3.5 py-3 text-[13.5px] text-[#0b3d38]">{t("nobody")}</p> : (
            <ul className="flex flex-wrap gap-2">
              {today.map((o) => {
                const m = who(o.user_id);
                return (
                  <li key={o.id}>
                    <Link prefetch={false} href={`/dashboard/jobs/time-off/${o.id}`}
                      className="group flex items-center gap-2.5 rounded-xl border border-slate-200 py-2 pl-2 pr-3.5 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_20px_rgba(15,40,60,0.07)]">
                      <span className="relative transition-transform duration-200 group-hover:scale-105">
                        {m ? <TechDot t={{ ...m, name: m.full_name }} size={34} ring={false} /> : <span className="block h-[34px] w-[34px] rounded-full bg-slate-200" />}
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white" style={{ background: OFF_COLOR[o.kind] }} />
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-[180px] truncate text-[14px] font-semibold text-[#0b1f3a]">{m?.full_name ?? "—"}</span>
                        <span className="block max-w-[220px] truncate text-[12.5px] text-slate-500">
                          <span className="font-medium" style={{ color: OFF_COLOR[o.kind] }}>{tk(`offKind.${o.kind}` as never)}</span> · {span(o)}{!o.all_day && nowOff(o) ? ` · ${t("now")}` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">{t("next7")}</p>
          {!soon.length ? <p className="text-[13.5px] text-slate-500">{t("noneSoon")}</p> : (
            <ul className="divide-y divide-slate-100">
              {soon.map((o) => {
                const m = who(o.user_id);
                return (
                  <li key={o.id}>
                    <Link prefetch={false} href={`/dashboard/jobs/time-off/${o.id}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-slate-50">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: OFF_COLOR[o.kind] }} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-[#0b1f3a]"><b className="font-semibold">{m?.full_name ?? "—"}</b> · {tk(`offKind.${o.kind}` as never)}</span>
                      <span className="shrink-0 text-[12.5px] text-slate-500">{day(new Date(o.starts_at))}{offHours(o, tag) ? ` · ${offHours(o, tag)}` : ""}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export function OffArt({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className="shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id="offA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2bb3a4" /><stop offset="1" stopColor="#0f766e" /></linearGradient>
        <linearGradient id="offB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fdba74" /><stop offset="1" stopColor="#e8713a" /></linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="#e9f7f4" />
      <rect x="10" y="13" width="24" height="23" rx="3.5" fill="#fff" stroke="url(#offA)" strokeWidth="2.2" />
      <path d="M10 19.5h24" stroke="url(#offA)" strokeWidth="2.2" />
      <path d="M16 10v6M28 10v6" stroke="#0b5e57" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M15.5 25.5h4M21.5 25.5h4M15.5 30.5h4" stroke="#bfe6da" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="34" cy="32" r="8" fill="url(#offB)" />
      <path d="M31 32.2a3.2 3.2 0 1 1 3.6 3.1" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M34 28.6v3.4l2 1.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
