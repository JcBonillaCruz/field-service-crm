"use client";

import { withTypePay } from "@/lib/type-pay";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TeamMember, addDays, isoDay } from "@/lib/jobs";
import { hm } from "@/lib/timesheets";
import {
  LOW_MARGIN, NOBODY, PartsRow, PersonRow, PnlGroup, PnlJob, REPORT_PERIODS, RawReport, ReportPeriod, buildParts, buildPnl, buildTeam, money0, needsReportSql, pnlPdf, qty, rangeText,
  reportError, reportRange, shortDay,
} from "@/lib/job-reports";
import SelectMenu from "@/components/ui/SelectMenu";
import ExportModal from "@/components/customers/ExportModal";
import PdfViewer from "@/components/ui/PdfViewer";
import type { PdfDoc } from "@/lib/report-pdf";
import { TechDot } from "@/components/jobs/EventBar";
import ReportArt, { ReportArtKind } from "@/components/jobs/reports/ReportArt";

type Tab = "team" | "parts" | "pnl";
const card = "rounded-2xl border border-slate-200 bg-white";
// Las columnas van escritas completas (Tailwind no arma clases a partir de números)
const TEAM_COLS: Record<number, string> = {
  6: "lg:grid-cols-[minmax(0,2.2fr)_repeat(6,minmax(0,1fr))_1.25rem]",
  7: "lg:grid-cols-[minmax(0,2.2fr)_repeat(7,minmax(0,1fr))_1.25rem]",
  8: "lg:grid-cols-[minmax(0,2.2fr)_repeat(8,minmax(0,1fr))_1.25rem]",
};
const PNL_COLS = "lg:grid-cols-[minmax(0,2.4fr)_repeat(6,minmax(0,1fr))]";
const GROUP_COLS = "grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]";
const PARTS_COLS: Record<number, string> = {
  4: "lg:grid-cols-[minmax(0,2.2fr)_repeat(4,minmax(0,1fr))_1.25rem]",
  5: "lg:grid-cols-[minmax(0,2.2fr)_repeat(5,minmax(0,1fr))_1.25rem]",
};
const Chevron = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 5l5 5-5 5" /></svg>
);
const Lock = () => (
  <svg viewBox="0 0 20 20" className="inline h-3 w-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-label="Only the owner and the manager see this"><rect x="4.5" y="9" width="11" height="7.5" rx="1.5" /><path d="M7 9V7a3 3 0 0 1 6 0v2" /></svg>
);

// Reports de Jobs (Paso 5.10): rendimiento de cada colaborador y piezas cobradas que no se escanearon.
// Dueño y manager ven todo el dinero (facturado, costos, mano de obra y ganancia) y la pestaña Profit & loss;
// la oficina ve lo demás sin dinero (lo decide la base de datos).
export default function JobReports({ companyId, team, weekStartsOn, initialTab = "team", companyName = "", preparedBy = "" }: {
  companyId: string; team: TeamMember[]; weekStartsOn: number; initialTab?: Tab; companyName?: string; preparedBy?: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [raw, setRaw] = useState<RawReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needSql, setNeedSql] = useState(false);
  const [q, setQ] = useState("");
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [pdf, setPdf] = useState<PdfDoc | null>(null); // el Profit & loss como PDF real, en el visor
  const { from, to } = useMemo(() => reportRange(period, weekStartsOn), [period, weekStartsOn]);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createClient();
    const { data, error: e } = await sb.rpc("job_reports", { p_company: companyId, p_from: from.toISOString(), p_to: to.toISOString() });
    if (e) { setLoading(false); setNeedSql(needsReportSql(e)); setError(reportError(e)); return; }
    // Paso 5.10f: la mano de obra con el pago por tipo de trabajo aplicado (si hay reglas)
    const withPay = await withTypePay(sb, companyId, data as RawReport).catch(() => data as RawReport);
    setLoading(false); setNeedSql(false); setError(""); setRaw(withPay);
  }, [companyId, from, to]);
  useEffect(() => { load(); }, [load]);

  const teamRep = useMemo(() => (raw ? buildTeam(raw, team) : null), [raw, team]);
  const partsRep = useMemo(() => (raw ? buildParts(raw, team) : null), [raw, team]);
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const match = (name: string, m: TeamMember | null) => terms.every((t) => `${name} ${m?.job_title ?? ""} ${m?.role ?? ""}`.toLowerCase().includes(t));
  const people = (teamRep?.rows ?? []).filter((r) => match(r.name, r.member));
  const partRows = (partsRep?.rows ?? []).filter((r) => match(r.name, r.member));
  const money = Boolean(raw?.money), owner = Boolean(raw?.labor); // owner = ve costos y mano de obra (dueño y manager)
  const pnl = useMemo(() => (raw && raw.labor ? buildPnl(raw, team) : null), [raw, team]);
  const oldSql = Boolean(raw && raw.money && raw.costs === undefined); // falta correr paso-5.10b
  const tabs: Tab[] = owner ? ["team", "parts", "pnl"] : ["team", "parts"];
  const shown: Tab = tabs.includes(tab) ? tab : "team";
  const periodLabel = REPORT_PERIODS.find((p) => p.value === period)?.label ?? "This period";
  // PDF real en el visor (imprimir o descargar): lo que el manager le entrega al dueño
  const printPnl = () => { if (pnl) setPdf(pnlPdf(pnl, { company: companyName, period: periodLabel, range: rangeText(from, to), by: preparedBy || "the manager" })); };
  const toggle = (id: string) => setOpenIds((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  // Celular: se cambia de pestaña deslizando (regla de todo el sistema)
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    const i = tabs.indexOf(shown) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < tabs.length) setTab(tabs[i]);
  };

  const kpi = (art: ReportArtKind, title: string, value: string, hint: string, tone = "text-[#0b1f3a]", lock = false) => (
    <div className="group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,40,60,0.08)]">
      <ReportArt kind={art} size={44} />
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-medium text-slate-500">{title} {lock && <Lock />}</span>
        <span className={`block text-[20px] font-semibold leading-tight tabular-nums ${tone}`}>{loading && !raw ? "…" : value}</span>
        <span className="block truncate text-[11.5px] text-slate-400">{hint}</span>
      </span>
    </div>
  );
  const who = (name: string, m: TeamMember | null, sub?: string) => (
    <span className="flex min-w-0 items-center gap-2.5">
      {m ? <TechDot t={{ initials: m.initials, color: m.color, avatar_url: m.avatar_url, name: m.full_name }} size={30} ring={false} />
        : <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-500">—</span>}
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold text-[#0b1f3a]">{name}</span>
        <span className="block truncate text-[12px] text-slate-400">{sub ?? (m ? `${m.job_title || m.role}${m.worker_type === "subcontractor" ? " · subcontractor" : ""}` : "No longer on the team")}</span>
      </span>
    </span>
  );
  // Celda: en el celular lleva su etiqueta arriba; en computadora la etiqueta está en el encabezado
  const cell = (label: string, value: React.ReactNode, sub?: React.ReactNode, cls = "") => (
    <span className={`min-w-0 ${cls}`}>
      <span className="block text-[11px] font-medium text-slate-400 lg:hidden">{label}</span>
      <span className="block truncate text-[14px] font-semibold tabular-nums text-[#0b1f3a]">{value}</span>
      {sub != null && <span className="block truncate text-[11.5px] text-slate-400">{sub}</span>}
    </span>
  );

  // ---------- Team performance ----------
  const teamCols = TEAM_COLS[6 + (money ? 1 : 0) + (owner ? 1 : 0)];
  const personLine = (r: PersonRow) => {
    const open = openIds.includes(`t:${r.user_id}`);
    const quiet = r.visits === 0 && r.shiftMin === 0 && r.siteMin === 0;
    return (
      <li key={r.user_id} className={quiet ? "opacity-60" : ""}>
        <button type="button" onClick={() => toggle(`t:${r.user_id}`)} aria-expanded={open}
          className={`grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 px-3.5 py-3 text-left transition-colors hover:bg-[#f6fbfa] lg:px-5 ${teamCols}`}>
          <span className="col-span-3 flex items-center justify-between gap-2 lg:col-span-1">{who(r.name, r.member)}<span className="lg:hidden"><Chevron open={open} /></span></span>
          {cell("Jobs done", r.jobsDone, r.returns ? `${r.returns} return visit${r.returns === 1 ? "" : "s"}` : `${r.visits} visit${r.visits === 1 ? "" : "s"}`)}
          {cell("On time", r.onTimePct == null ? "—" : `${r.onTimePct}%`, r.late ? <span className="text-[#be123c]">{r.late} late · avg {hm(r.lateMinAvg, "0m")}</span> : r.measured ? "Never late" : "No scheduled visits")}
          {cell("Avg on site", hm(r.avgSiteMin), `Total ${hm(r.siteMin, "0m")}`)}
          {cell("Travel", hm(r.travelMin), r.shiftMin > 0 ? `Clocked ${hm(r.shiftMin)}` : "No clock-in")}
          {cell("On jobs", r.utilPct == null ? "—" : `${r.utilPct}%`, r.utilPct == null ? "Of the clocked day" : `${hm(r.idleMin, "0m")} not on a job`)}
          {cell("Follow-ups", <span className={r.held ? "text-[#b45309]" : ""}>{r.held}</span>, r.held ? "Paused or not finished" : "None")}
          {money && cell("Revenue", money0(r.revenue), "From jobs done")}
          {owner && cell("Labor", r.salaried ? "Salary" : money0(r.labor), r.noRate ? <span className="text-[#b45309]">No pay rate yet</span> : r.salaried ? "Not per job" : "On-site hours × rate")}
          <span className="hidden lg:block"><Chevron open={open} /></span>
        </button>
        {open && (
          <div className="bg-[#f8fafb] px-3.5 py-3 lg:px-5">
            {r.jobs.length === 0 ? <p className="py-1 text-[13px] text-slate-500">No visits worked in this period.</p> : (
              <ul className="space-y-1.5">
                {r.jobs.map((j) => (
                  <li key={j.key}>
                    <Link prefetch={false} href={`/dashboard/jobs/${j.job_id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 transition-colors hover:border-[#8fd3c5]">
                      <span className="w-16 shrink-0 text-[12.5px] tabular-nums text-slate-500">{shortDay(j.when)}</span>
                      <span className="min-w-0 flex-1 basis-40">
                        <span className="block truncate text-[13.5px] font-semibold text-[#0b1f3a]">{j.customer || "No customer"}</span>
                        <span className="block truncate text-[12px] text-slate-400">{j.number}{j.visit_no > 1 ? ` · visit ${j.visit_no}` : ""}{j.title ? ` · ${j.title}` : ""}</span>
                      </span>
                      {j.status === "completed" ? <Pill tone="green">Done</Pill> : j.held ? <Pill tone="amber">Not finished</Pill> : <Pill tone="blue">In progress</Pill>}
                      {j.lateMin == null ? <span className="w-24 text-[12.5px] text-slate-400">No set time</span>
                        : j.lateMin > 0 ? <span className="w-24 text-[12.5px] font-medium text-[#be123c]">{hm(j.lateMin)} late</span>
                          : <span className="w-24 text-[12.5px] font-medium text-[#15803d]">On time</span>}
                      <span className="w-40 text-[12.5px] text-slate-500">On site <b className="tabular-nums text-slate-700">{hm(j.siteMin, "0m")}</b> · Travel <b className="tabular-nums text-slate-700">{hm(j.travelMin, "0m")}</b></span>
                      {money && <span className="w-20 text-right text-[13px] font-semibold tabular-nums text-[#0b1f3a]">{j.revenue == null ? "—" : money0(j.revenue)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </li>
    );
  };

  // ---------- Unscanned parts ----------
  const partsCols = PARTS_COLS[4 + (money ? 1 : 0)];
  const partsLine = (r: PartsRow) => {
    const open = openIds.includes(`p:${r.user_id}`);
    return (
      <li key={r.user_id}>
        <button type="button" onClick={() => toggle(`p:${r.user_id}`)} aria-expanded={open}
          className={`grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 px-3.5 py-3 text-left transition-colors hover:bg-[#f6fbfa] lg:px-5 ${partsCols}`}>
          <span className="col-span-2 flex items-center justify-between gap-2 lg:col-span-1">
            {who(r.name, r.member, r.user_id === NOBODY ? "Jobs with nobody assigned" : r.user_id.startsWith("count:") ? "From inventory counts" : undefined)}
            <span className="lg:hidden"><Chevron open={open} /></span>
          </span>
          {cell("Not scanned", <span className={r.units ? "text-[#be123c]" : ""}>{qty(r.units)}</span>, r.units ? "Parts charged, not scanned" : "All scanned")}
          {money && cell("Value", <span className={r.value ? "text-[#be123c]" : ""}>{money0(r.value)}</span>, "At the price charged")}
          {cell("Jobs", r.jobs, r.jobs ? "With unscanned parts" : "None")}
          {cell("No scan at all", r.noScan.length, "Finished jobs")}
          {cell("Missing in counts", <span className={r.countUnits ? "text-[#b45309]" : ""}>{qty(r.countUnits)}</span>, r.countUnits ? (money ? `${money0(r.countValue)} at cost` : "From van counts") : "Nothing missing")}
          <span className="hidden lg:block"><Chevron open={open} /></span>
        </button>
        {open && (
          <div className="space-y-3 bg-[#f8fafb] px-3.5 py-3 lg:px-5">
            {r.lines.length > 0 && (
              <div>
                <p className="mb-1.5 text-[12.5px] font-semibold text-slate-500">Charged but not scanned from the van</p>
                <ul className="space-y-1.5">
                  {r.lines.map((l) => (
                    <li key={l.key}>
                      <Link prefetch={false} href={`/dashboard/jobs/${l.job_id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 transition-colors hover:border-[#fda4af]">
                        <span className="w-16 shrink-0 text-[12.5px] tabular-nums text-slate-500">{shortDay(l.when)}</span>
                        <span className="min-w-0 flex-1 basis-44">
                          <span className="block truncate text-[13.5px] font-semibold text-[#0b1f3a]">{l.name}{l.sku ? <span className="font-normal text-slate-400"> · {l.sku}</span> : null}</span>
                          <span className="block truncate text-[12px] text-slate-400">{l.number} · {l.customer || "No customer"}{l.shared > 1 ? ` · ${l.shared} collaborators on this job` : ""}</span>
                        </span>
                        <span className="text-[12.5px] text-slate-500">{l.onInvoice ? "Invoiced" : "On the job"} <b className="tabular-nums text-slate-700">{qty(l.billed)}</b> · Scanned <b className="tabular-nums text-slate-700">{qty(l.scanned)}</b></span>
                        <span className="w-24 text-right text-[13px] font-semibold tabular-nums text-[#be123c]">{qty(l.missing)} not scanned</span>
                        {money && <span className="w-20 text-right text-[13px] font-semibold tabular-nums text-[#0b1f3a]">{money0(l.value)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {r.noScan.length > 0 && (
              <div>
                <p className="mb-1.5 text-[12.5px] font-semibold text-slate-500">Finished without scanning any part <span className="font-normal text-slate-400">· fine for a tune-up or a visit that needed no parts</span></p>
                <ul className="flex flex-wrap gap-1.5">
                  {r.noScan.map((j) => (
                    <li key={j.job_id}>
                      <Link prefetch={false} href={`/dashboard/jobs/${j.job_id}`} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] text-slate-600 transition-colors hover:border-[#8fd3c5]">
                        <span className="tabular-nums text-slate-400">{shortDay(j.when)}</span>
                        <span className="truncate font-medium text-[#0b1f3a]">{j.customer || j.number}</span>
                        <span className="text-slate-400">{j.number}</span>
                        {money && j.revenue ? <span className="tabular-nums">{money0(j.revenue)}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {r.countUnits > 0 && (
              <p className="text-[12.5px] text-slate-500">
                <b className="text-[#b45309]">{qty(r.countUnits)} unit{r.countUnits === 1 ? "" : "s"}</b> came up missing in the counts of this period.{" "}
                <Link prefetch={false} href="/dashboard/inventory/counts" className="font-semibold text-[#0f766e] hover:underline">See the counts</Link>
              </p>
            )}
            {r.lines.length === 0 && r.noScan.length === 0 && r.countUnits === 0 && <p className="py-1 text-[13px] text-slate-500">Nothing to review for this person.</p>}
          </div>
        )}
      </li>
    );
  };

  const tt = teamRep?.totals, pt = partsRep?.totals;
  const head = (labels: string[], cols: string) => (
    <div className={`hidden items-center gap-x-3 border-b border-slate-100 px-5 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-slate-400 lg:grid ${cols}`}>
      {labels.map((l) => <span key={l} className="truncate">{l}</span>)}<span />
    </div>
  );
  const tabBtn = (id: Tab, label: string, short: string, badge?: number) => (
    <button type="button" role="tab" aria-selected={shown === id} onClick={() => setTab(id)}
      className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[13.5px] font-semibold transition-colors sm:flex-none sm:gap-2 sm:px-3.5 ${shown === id ? "bg-white text-[#0f766e] shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-[#0b1f3a]"}`}>
      <span className="hidden sm:inline">{label}</span><span className="truncate sm:hidden">{short}</span>
      {badge ? <span className="rounded-full bg-[#ffe4e6] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#be123c]">{badge}</span> : null}
    </button>
  );

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f4f6f8] px-3 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="group mr-auto flex min-w-0 items-center gap-3">
          <span className="hidden shrink-0 sm:inline-flex"><ReportArt kind="title" size={44} /></span>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">Reports</h1>
            <p className="text-[13px] text-slate-500">How each collaborator is doing, and the parts that were charged but never scanned.</p>
          </div>
        </div>
        <div className="w-40"><SelectMenu ariaLabel="Period" value={period} onChange={(v) => { setPeriod(v as ReportPeriod); setOpenIds([]); }} options={REPORT_PERIODS} /></div>
        <button type="button" onClick={() => setExportOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[13.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3v9M6.5 8.5 10 12l3.5-3.5M4 15.5h12" /></svg>Export
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex w-full gap-1 rounded-2xl bg-slate-200/60 p-1 sm:w-auto">
          {tabBtn("team", "Team performance", "Team")}
          {tabBtn("parts", "Unscanned parts", "Parts", pt?.jobs)}
          {owner && tabBtn("pnl", "Profit & loss", "Profit", pnl?.totals.lossJobs)}
        </div>
        <p className="text-[12.5px] text-slate-500">{rangeText(from, to)}</p>
        {shown !== "pnl" && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a person" aria-label="Search a person"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[14px] placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15 sm:ml-auto sm:w-56" />}
        {shown === "pnl" && (
          <button type="button" onClick={printPnl} disabled={!pnl}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f766e] px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0b5f59] disabled:opacity-50 sm:ml-auto">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7V3h8v4M6 14H4.5A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7h11A1.5 1.5 0 0 1 17 8.5v4a1.5 1.5 0 0 1-1.5 1.5H14M6 11.5h8V17H6z" /></svg>Print / PDF
          </button>
        )}
      </div>

      {needSql ? (
        <div className={`${card} mt-5 px-5 py-10 text-center`}>
          <p className="text-[15px] font-semibold text-[#0b1f3a]">One step left</p>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] text-slate-500">Run <b>paso-5.10-reports.sql</b> in Supabase → SQL Editor, then reload this page.</p>
        </div>
      ) : error ? (
        <div className={`${card} mt-5 px-5 py-8 text-center`}>
          <p role="alert" className="text-[14px] text-[#be123c]">{error}</p>
          <button type="button" onClick={load} className="mt-3 rounded-xl bg-[#0f766e] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#0b5f59]">Try again</button>
        </div>
      ) : (
        <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className={`transition-opacity duration-200 ${loading && raw ? "opacity-60" : ""}`}>
          {shown === "pnl" && pnl ? <PnlView pnl={pnl} oldSql={oldSql} kpi={kpi} /> : shown === "team" ? <>
            <div className={`mt-4 grid grid-cols-2 gap-3 ${money ? "xl:grid-cols-6" : "xl:grid-cols-5"} md:grid-cols-3`}>
              {kpi("done", "Jobs completed", String(tt?.jobsDone ?? 0), `${tt?.visits ?? 0} visit${tt?.visits === 1 ? "" : "s"} worked`)}
              {kpi("ontime", "Arrived on time", tt?.onTimePct == null ? "—" : `${tt.onTimePct}%`, tt?.measured ? `${tt.onTime} of ${tt.measured} visits` : "No scheduled visits yet")}
              {kpi("site", "Avg time on site", hm(tt?.avgSiteMin ?? 0), `Total ${hm(tt?.siteMin ?? 0, "0m")}`)}
              {kpi("idle", "Time on jobs", tt?.utilPct == null ? "—" : `${tt.utilPct}%`, tt?.utilPct == null ? "Nobody clocked in" : `Travel ${hm(tt.travelMin, "0m")} · of the clocked day`)}
              {kpi("held", "Need follow-up", String(tt?.held ?? 0), tt?.returns ? `${tt.returns} return visit${tt.returns === 1 ? "" : "s"}` : "Paused or not finished", tt?.held ? "text-[#b45309]" : undefined)}
              {money && kpi("revenue", "Revenue", money0(tt?.revenue), owner && tt?.labor != null ? `Labor ${money0(tt.labor)}` : "From jobs completed, before tax")}
            </div>
            <section className={`${card} mt-4 overflow-hidden`}>
              {head(["Collaborator", "Jobs done", "On time", "Avg on site", "Travel", "On jobs", "Follow-ups", ...(money ? ["Revenue"] : []), ...(owner ? ["Labor"] : [])], teamCols)}
              {loading && !raw ? <Skeleton /> : people.length === 0 ? <Empty text={q ? "Nobody matches that search." : "No collaborators yet. Add them in Team."} /> : <ul className="divide-y divide-slate-100">{people.map(personLine)}</ul>}
            </section>
            <p className="mt-3 text-[12.5px] text-slate-500">
              On time means the work started inside the arrival window. &ldquo;On jobs&rdquo; compares travel and on-site time with the clocked day (Clock in → Clock out).
              {owner && <> Labor uses the pay rates in Team → Edit; only the owner and the manager see it.</>}
            </p>
          </> : <>
            <div className={`mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 ${money ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
              {kpi("parts", "Parts not scanned", qty(pt?.units ?? 0), pt?.units ? "Charged, never left a van" : "Everything was scanned", pt?.units ? "text-[#be123c]" : undefined)}
              {money && kpi("value", "Value not scanned", money0(pt?.value), "At the price charged", pt?.value ? "text-[#be123c]" : undefined)}
              {kpi("done", "Jobs to review", String(pt?.jobs ?? 0), `Of ${pt?.doneJobs ?? 0} finished`, pt?.jobs ? "text-[#b45309]" : undefined)}
              {kpi("noscan", "No part scanned", String(pt?.noScanJobs ?? 0), "Finished jobs with no scan")}
              {kpi("counts", "Missing in counts", qty(pt?.countUnits ?? 0), pt?.countUnits ? (money ? `${money0(pt.countValue)} at cost` : "From van counts") : "Nothing missing", pt?.countUnits ? "text-[#b45309]" : undefined)}
            </div>
            <section className={`${card} mt-4 overflow-hidden`}>
              {head(["Collaborator", "Not scanned", ...(money ? ["Value"] : []), "Jobs", "No scan at all", "Missing in counts"], partsCols)}
              {loading && !raw ? <Skeleton /> : partRows.length === 0 ? <Empty text={q ? "Nobody matches that search." : "Nothing to review: every part charged in this period was scanned from a van."} good={!q} /> : <ul className="divide-y divide-slate-100">{partRows.map(partsLine)}</ul>}
            </section>
            <p className="mt-3 text-[12.5px] text-slate-500">
              How to read it: a part that is on the job or on its invoice but was never scanned didn&apos;t come out of anyone&apos;s stock in the system. Either it was used without scanning, or it was charged and not installed.
              When a job had several collaborators, the part shows under each of them. <Link prefetch={false} href="/dashboard/inventory/reports" className="font-semibold text-[#0f766e] hover:underline">Inventory reports</Link> show what each van used and was restocked.
            </p>
          </>}
        </div>
      )}

      {pdf && <PdfViewer doc={pdf} onClose={() => setPdf(null)} />}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} initialModule={shown === "team" ? "Team performance" : shown === "pnl" ? "Profit and loss" : "Unscanned parts"} defaultScope="view"
        view={{
          module: shown === "team" ? "Team performance" : shown === "pnl" ? "Profit and loss" : "Unscanned parts", label: periodLabel,
          ids: shown === "pnl" ? (pnl?.jobs ?? []).map((j) => j.job_id) : (shown === "team" ? people : partRows).map((r) => r.user_id), columns: [], range: { from: isoDay(from), to: isoDay(addDays(to, -1)) },
        }} />
    </div>
  );
}

// ---------- Profit & loss (dueño y manager) ----------
type KpiFn = (art: ReportArtKind, title: string, value: string, hint: string, tone?: string, lock?: boolean) => React.ReactNode;
function PnlView({ pnl, oldSql, kpi }: { pnl: import("@/lib/job-reports").Pnl; oldSql: boolean; kpi: KpiFn }) {
  const [all, setAll] = useState(false);
  const t = pnl.totals;
  const tone = (v: number) => (v < 0 ? "text-[#be123c]" : "text-[#15803d]");
  const share = (v: number) => (t.revenue > 0 ? Math.max(0, Math.min(100, (v / t.revenue) * 100)) : 0);
  const bars = [
    { label: "Labor", v: t.labor, color: "#f59e0b" }, { label: "Materials", v: t.materials, color: "#2563eb" },
    { label: "Expenses", v: t.expenses, color: "#7c3aed" }, { label: t.profit >= 0 ? "Profit" : "Loss", v: t.profit, color: t.profit >= 0 ? "#16a34a" : "#e11d48" },
  ];
  const list = all ? pnl.jobs : pnl.jobs.slice(0, 12);
  const cell = (label: string, value: React.ReactNode, cls = "") => (
    <span className={`min-w-0 ${cls}`}>
      <span className="block text-[11px] font-medium text-slate-400 lg:hidden">{label}</span>
      <span className="block truncate text-[13.5px] font-semibold tabular-nums text-[#0b1f3a]">{value}</span>
    </span>
  );
  const jobLine = (j: PnlJob) => (
    <li key={j.job_id}>
      <Link prefetch={false} href={`/dashboard/jobs/${j.job_id}`} className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3.5 py-3 transition-colors hover:bg-[#f6fbfa] lg:px-5 ${PNL_COLS} ${j.loss ? "bg-[#fff8f8]" : ""}`}>
        <span className="col-span-3 min-w-0 lg:col-span-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-[#0b1f3a]">{j.customer || "No customer"}</span>
            {j.loss ? <span className="shrink-0 rounded-full bg-[#ffe4e6] px-2 py-0.5 text-[11px] font-semibold text-[#be123c]">Lost money</span>
              : j.revenue > 0 && (j.margin ?? 100) < LOW_MARGIN ? <span className="shrink-0 rounded-full bg-[#fff6e6] px-2 py-0.5 text-[11px] font-semibold text-[#b45309]">Low margin</span> : null}
          </span>
          <span className="block truncate text-[12px] text-slate-400">{shortDay(j.when)} · {j.number} · {j.type}{j.techs.length ? ` · ${j.techs.join(", ")}` : ""}</span>
          {j.reasons.length > 0 && <span className="block truncate text-[12px] text-[#92400e]">{j.reasons.join(" · ")}</span>}
        </span>
        {cell("Revenue", money0(j.revenue))}
        {cell("Labor", money0(j.labor))}
        {cell("Materials", money0(j.materials))}
        {cell("Expenses", money0(j.expenses))}
        {cell("Profit", <span className={tone(j.profit)}>{money0(j.profit)}</span>)}
        {cell("Margin", j.margin == null ? "—" : `${j.margin}%`)}
      </Link>
    </li>
  );
  const groupCard = (title: string, note: string, rows: PnlGroup[]) => (
    <section className={`${card} overflow-hidden`}>
      <div className="border-b border-slate-100 px-4 py-3 lg:px-5"><p className="text-[15px] font-semibold text-[#0b1f3a]">{title}</p><p className="text-[12.5px] text-slate-500">{note}</p></div>
      {rows.length === 0 ? <p className="px-5 py-6 text-center text-[13px] text-slate-500">Nothing in this period.</p> : (
        <div>
          <div className={`grid items-center gap-x-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:px-5 ${GROUP_COLS}`}><span /><span>Jobs</span><span>Revenue</span><span>Costs</span><span>Profit</span></div>
          <ul className="divide-y divide-slate-100">
            {rows.map((g) => (
              <li key={g.key} className={`grid items-center gap-x-3 px-4 py-2.5 text-[13.5px] tabular-nums lg:px-5 ${GROUP_COLS}`}>
                <span className="min-w-0"><span className="block truncate font-semibold text-[#0b1f3a]">{g.name}</span>{g.losses > 0 && <span className="block text-[11.5px] text-[#be123c]">{g.losses} lost money</span>}</span>
                <span className="text-slate-600">{g.jobs}</span><span className="truncate text-slate-600">{money0(g.revenue)}</span><span className="truncate text-slate-600">{money0(g.costs)}</span>
                <span className={`truncate font-semibold ${tone(g.profit)}`}>{money0(g.profit)}{g.margin != null && <span className="ml-1 text-[11.5px] font-normal text-slate-400">{g.margin}%</span>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );

  return (
    <>
      {oldSql && <p className="mt-4 rounded-xl border border-[#fcd38d] bg-[#fffbf3] px-4 py-3 text-[13px] text-[#92400e]">Run <b>paso-5.10b-reports-manager.sql</b> in Supabase to include materials and expenses here. Until then they count as $0.</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpi("revenue", "Revenue", money0(t.revenue), `${t.jobs} job${t.jobs === 1 ? "" : "s"} finished · before tax`)}
        {kpi("idle", "Costs", money0(t.costs), `Labor ${money0(t.labor)} · Parts ${money0(t.materials)}`)}
        {kpi("profit", t.profit >= 0 ? "Profit" : "Loss", money0(t.profit), t.margin == null ? "No revenue yet" : `${t.margin}% margin`, tone(t.profit))}
        {kpi("value", "Jobs that lost money", String(t.lossJobs), t.lossJobs ? `${money0(t.lossAmount)} lost` : "None", t.lossJobs ? "text-[#be123c]" : undefined)}
        {kpi("parts", "Parts not accounted", money0(t.unscannedValue + t.countValue), "Not scanned + missing in counts", t.unscannedValue + t.countValue > 0 ? "text-[#b45309]" : undefined)}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className={`${card} p-4 lg:p-5`}>
          <p className="text-[15px] font-semibold text-[#0b1f3a]">Summary for the owner</p>
          <ul className="mt-2 space-y-1.5">
            {pnl.findings.map((f) => (
              <li key={f} className="flex gap-2 text-[13.5px] text-slate-700"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#14a39a]" />{f}</li>
            ))}
          </ul>
        </section>
        <section className={`${card} p-4 lg:p-5`}>
          <p className="text-[15px] font-semibold text-[#0b1f3a]">Where the money went</p>
          <p className="text-[12.5px] text-slate-500">Out of every dollar of revenue.</p>
          <ul className="mt-3 space-y-2.5">
            {bars.map((b) => (
              <li key={b.label}>
                <div className="flex items-center justify-between text-[13px]"><span className="text-slate-600">{b.label}</span>
                  <span className="tabular-nums text-slate-700"><b className="text-[#0b1f3a]">{money0(b.v)}</b>{t.revenue > 0 && <span className="ml-1.5 text-slate-400">{Math.round((b.v / t.revenue) * 100)}%</span>}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${share(Math.abs(b.v))}%`, background: b.color }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={`${card} mt-4 overflow-hidden`}>
        <div className="border-b border-slate-100 px-4 py-3 lg:px-5"><p className="text-[15px] font-semibold text-[#0b1f3a]">Job by job</p><p className="text-[12.5px] text-slate-500">From the biggest loss to the biggest profit. Tap a job to open it.</p></div>
        <div className={`hidden items-center gap-x-3 border-b border-slate-100 px-5 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-slate-400 lg:grid ${PNL_COLS}`}>
          {["Job", "Revenue", "Labor", "Materials", "Expenses", "Profit", "Margin"].map((l) => <span key={l}>{l}</span>)}
        </div>
        {pnl.jobs.length === 0 ? <Empty text="No jobs were finished in this period." /> : <ul className="divide-y divide-slate-100">{list.map(jobLine)}</ul>}
        {pnl.jobs.length > 12 && (
          <button type="button" onClick={() => setAll((a) => !a)} className="w-full border-t border-slate-100 py-2.5 text-[13px] font-semibold text-[#0f766e] hover:bg-[#f6fbfa]">{all ? "Show fewer" : `Show all ${pnl.jobs.length} jobs`}</button>
        )}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {groupCard("By job type", "Which kind of work makes or loses money.", pnl.byType)}
        {groupCard("By collaborator", "A job with several collaborators counts in full for each of them.", pnl.byPerson)}
      </div>
      <p className="mt-3 text-[12.5px] text-slate-500">
        Revenue is the invoice before tax; without an invoice, the price on the job. Labor is on-site hours × the pay rate in Team. Materials are the parts on the job at cost. Expenses are the ones linked to the job&apos;s invoice in Finances.
        {" "}This is the profit of the jobs only. Rent, fuel, insurance and what was really paid in payroll are in <Link prefetch={false} href="/dashboard/reports" className="font-semibold text-[#0f766e] hover:underline">Finances → Reports</Link>.
        Use <b>This week</b> or <b>This month</b> above, then <b>Print / PDF</b> to hand it to the owner. Only the owner and the manager see this tab.
      </p>
    </>
  );
}

function Pill({ tone, children }: { tone: "green" | "amber" | "blue"; children: React.ReactNode }) {
  const c = tone === "green" ? "bg-[#e7f8ee] text-[#15803d]" : tone === "amber" ? "bg-[#fff6e6] text-[#b45309]" : "bg-[#eef4ff] text-[#2563eb]";
  return <span className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[11.5px] font-semibold ${c}`}>{children}</span>;
}
function Empty({ text, good }: { text: string; good?: boolean }) {
  return (
    <div className="group flex flex-col items-center px-5 py-10 text-center">
      {good && <ReportArt kind="done" size={52} />}
      <p className="mt-2 max-w-md text-[13.5px] text-slate-500">{text}</p>
    </div>
  );
}
function Skeleton() {
  return (
    <ul className="divide-y divide-slate-100" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-3.5">
          <span className="h-[30px] w-[30px] animate-pulse rounded-full bg-slate-200" />
          <span className="h-3.5 w-40 animate-pulse rounded bg-slate-200" /><span className="ml-auto h-3.5 w-1/2 animate-pulse rounded bg-slate-100" />
        </li>
      ))}
    </ul>
  );
}
