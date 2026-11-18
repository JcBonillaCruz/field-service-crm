"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { askConfirm } from "@/lib/confirm";
import SelectMenu from "@/components/ui/SelectMenu";
import CustomerNotices, { useCustomerNotices } from "@/components/jobs/CustomerNotices";
import { CONF_META, CONF_ORDER, ConfRow, ConfState, countStates } from "@/lib/confirmations";

// =====================================================================
// Paso 5.8b · Confirmations (menú de Jobs): las próximas visitas y qué respondió cada cliente.
// La oficina ve de un vistazo a quién llamar o volver a recordar, sin entrar trabajo por trabajo.
// =====================================================================
type Show = ConfState | "all";
const PERIODS = [{ value: "3", label: "Next 3 days" }, { value: "7", label: "Next 7 days" }, { value: "14", label: "Next 14 days" }];
const SHOWS: { value: Show; label: string }[] = [{ value: "all", label: "All visits" }, ...CONF_ORDER.map((s) => ({ value: s as Show, label: CONF_META[s].label }))];
const time = (r: ConfRow) => {
  const s = new Date(r.starts_at), t = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return r.arrival_window_min > 0 ? `${t(s)} – ${t(new Date(s.getTime() + r.arrival_window_min * 60000))}` : t(s);
};
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
function dayLabel(iso: string) {
  const d = new Date(iso), today = new Date(), tomorrow = new Date(Date.now() + 86400000);
  const name = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  return dayKey(iso) === dayKey(today.toISOString()) ? `Today · ${name}` : dayKey(iso) === dayKey(tomorrow.toISOString()) ? `Tomorrow · ${name}` : name;
}
const ago = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

// Ícono ilustrado (mismo estilo que los de la app)
export function ConfirmArt({ size = 44, state }: { size?: number; state?: ConfState }) {
  const c = state ? CONF_META[state].dot : "#14a39a";
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="shrink-0 transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105">
      <circle cx="24" cy="24" r="22" fill={`${c}1f`} />
      <rect x="12" y="14" width="24" height="22" rx="3.5" fill="#fff" stroke={c} strokeWidth="1.6" />
      <path d="M12 20h24M18 11v5M30 11v5" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      {state === "asked" ? <path d="M19 28h10m0 0-3-3m3 3-3 3" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        : state === "waiting" ? <><circle cx="24" cy="28" r="5" fill="none" stroke={c} strokeWidth="1.8" /><path d="M24 25.5V28l1.8 1.2" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none" /></>
        : state === "not_reminded" ? <path d="M19 28h10" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
        : <path d="m19 28 3.4 3.4L29.5 24" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
    </svg>
  );
}

export default function Confirmations({ companyId, rows, autoOn, days, initialShow }: { companyId: string; rows: ConfRow[]; autoOn: boolean; days: number; initialShow: Show }) {
  const router = useRouter();
  const [show, setShow] = useState<Show>(initialShow);
  const [period, setPeriod] = useState("7");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ m: string; err?: boolean } | null>(null);
  const flash = (m: string, err = false) => { setToast({ m, err }); setTimeout(() => setToast((t) => (t?.m === m ? null : t)), err ? 5000 : 3200); };

  // En vivo: cuando un cliente confirma o pide otro horario, la lista cambia sola
  useEffect(() => {
    const sb = createClient();
    let t: ReturnType<typeof setTimeout>;
    const ch = sb.channel(`confirmations-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visits", filter: `company_id=eq.${companyId}` }, () => { clearTimeout(t); t = setTimeout(() => router.refresh(), 700); })
      .subscribe();
    return () => { clearTimeout(t); sb.removeChannel(ch); };
  }, [companyId, router]);

  const inPeriod = useMemo(() => { const until = Date.now() + Number(period) * 86400000; return rows.filter((r) => new Date(r.starts_at).getTime() < until); }, [rows, period]);
  const counts = useMemo(() => countStates(inPeriod), [inPeriod]);
  const list = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return inPeriod.filter((r) => (show === "all" || r.state === show) && terms.every((t) => `${r.customer_name} ${r.number} ${r.title ?? ""} ${r.customer_phone ?? ""}`.toLowerCase().includes(t)));
  }, [inPeriod, show, q]);
  const groups = useMemo(() => {
    const m = new Map<string, ConfRow[]>();
    list.forEach((r) => m.set(dayKey(r.starts_at), [...(m.get(dayKey(r.starts_at)) ?? []), r]));
    return Array.from(m.entries());
  }, [list]);

  async function remindAll() {
    if (!(await askConfirm({
      title: "Send the pending reminders now?",
      message: `Every customer with a visit ${days === 2 ? "in the next 2 days" : "tomorrow"} who hasn't been reminded gets the email with the Confirm and Request another time buttons. Nobody gets it twice.`,
      confirmLabel: "Send reminders", tone: "green",
    }))) return;
    setBusy(true);
    const r = await fetch("/api/jobs/confirmations", { method: "POST" }).then((x) => x.json()).catch(() => null) as { ok?: boolean; sent?: number; noEmail?: number; failed?: number } | null;
    setBusy(false);
    if (!r?.ok) return flash("Couldn't send the reminders. Try again.", true);
    const parts = [`${r.sent ?? 0} sent`, r.noEmail ? `${r.noEmail} without email (use Text or WhatsApp)` : "", r.failed ? `${r.failed} failed` : ""].filter(Boolean);
    flash(r.sent || r.noEmail || r.failed ? parts.join(" · ") : `Nothing to send: no visits ${days === 2 ? "in the next 2 days" : "tomorrow"} are waiting for a reminder.`, Boolean(r.failed));
    router.refresh();
  }

  return (
    <div className="px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="group flex items-center gap-3">
          <ConfirmArt size={46} />
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">Customer confirmations</h1>
            <p className="text-[13.5px] text-slate-500">Upcoming visits and what each customer answered.</p>
          </div>
        </div>
        <button type="button" onClick={remindAll} disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f766e] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            : <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6.5h16v11H4zM4 7l8 6 8-6" /></svg>}
          Send reminders now
        </button>
      </div>

      <p className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-600">
        {autoOn ? <>Automatic reminders are <b className="text-[#0f766e]">on</b>: every morning around 8 AM the system emails the customers with a visit {days === 2 ? "in 2 days" : "the next day"}.</>
          : <>Automatic reminders are <b className="text-[#b45309]">off</b>: nothing goes out by itself.</>}{" "}
        <Link prefetch={false} href="/dashboard/jobs/settings" className="font-semibold text-[#0f766e] hover:underline">Change in Settings</Link>
      </p>

      {/* Resumen: cada tarjeta filtra la lista */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CONF_ORDER.map((s) => (
          <button key={s} type="button" onClick={() => setShow(show === s ? "all" : s)} aria-pressed={show === s}
            className={`group flex items-center gap-3 rounded-2xl border bg-white px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,40,60,0.08)] ${show === s ? "border-[#14a39a] ring-2 ring-[#14a39a]/20" : "border-slate-200"}`}>
            <ConfirmArt size={40} state={s} />
            <span className="min-w-0"><span className="block text-[22px] font-semibold leading-none text-[#0b1f3a]">{counts[s]}</span>
              <span className="mt-1 block truncate text-[12.5px] text-slate-500">{CONF_META[s].short}</span></span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <div className="w-full sm:w-64"><SelectMenu value={show} ariaLabel="Show" options={SHOWS} onChange={(v) => setShow(v as Show)} /></div>
        <div className="w-[calc(50%-0.3125rem)] sm:w-44"><SelectMenu value={period} ariaLabel="Period" options={PERIODS} onChange={setPeriod} /></div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer or job" aria-label="Search"
          className="h-[46px] min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 text-[15px] text-slate-800 focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
      </div>

      {groups.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-[16px] font-semibold text-[#0b1f3a]">{rows.length ? "No visits match" : "No upcoming visits"}</p>
          <p className="mt-1 text-[13.5px] text-slate-500">{rows.length ? "Change the filter or the period." : "Scheduled jobs with a customer show up here."}</p>
        </div>
      ) : groups.map(([key, items]) => (
        <section key={key} className="mt-5">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-slate-400">{dayLabel(items[0].starts_at)} <span className="font-normal normal-case">· {items.length} visit{items.length === 1 ? "" : "s"}</span></h2>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {items.map((r) => {
              const m = CONF_META[r.state], isOpen = open === r.visit_id;
              return (
                <li key={r.visit_id}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3 sm:px-4">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.dot }} />
                    <div className="min-w-0 flex-1 basis-40">
                      <Link prefetch={false} href={`/dashboard/jobs/${r.job_id}`} className="block truncate text-[15px] font-semibold text-[#0b1f3a] hover:text-[#0f766e]">{r.customer_name || "Customer"}</Link>
                      <p className="truncate text-[12.5px] text-slate-500">{time(r)}{r.title ? ` · ${r.title}` : ""} · <span className="text-[11.5px]">{r.number}</span></p>
                      {r.state === "asked" && r.reply_note && <p className="mt-0.5 text-[12.5px] text-[#be123c]">“{r.reply_note}”</p>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ${m.pill}`} title={r.state === "waiting" ? `Reminded ${ago(r.reminder_sent_at)}` : r.reply_at ? ago(r.reply_at) : undefined}>{m.short}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {r.customer_phone && <a href={`tel:${r.customer_phone.replace(/[^\d+]/g, "")}`} className="flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition-colors hover:border-[#b6dcd5] hover:bg-[#e9f7f4] hover:text-[#0f766e]">Call</a>}
                      {r.state === "asked"
                        ? <Link prefetch={false} href={`/dashboard/jobs/${r.job_id}/edit`} className="flex h-9 items-center rounded-lg bg-[#be123c] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#9f1239]">Reschedule</Link>
                        : r.state !== "confirmed" && <button type="button" onClick={() => setOpen(isOpen ? null : r.visit_id)} aria-expanded={isOpen}
                            className={`flex h-9 items-center rounded-lg border px-3 text-[13px] font-semibold transition-colors ${isOpen ? "border-[#0f766e] bg-[#e9f7f4] text-[#0f766e]" : "border-slate-200 bg-white text-[#0f766e] hover:border-[#b6dcd5] hover:bg-[#e9f7f4]"}`}>Remind</button>}
                    </div>
                  </div>
                  {isOpen && <div className="border-t border-slate-100 bg-[#fbfcfd] px-4 pb-4 pt-1 sm:pl-10"><RowNotices jobId={r.job_id} onToast={flash} onDone={() => router.refresh()} /></div>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {toast && <div role="status" className={`fixed bottom-24 left-1/2 z-[95] max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[14px] font-medium text-white shadow-lg lg:bottom-8 ${toast.err ? "bg-[#be123c]" : "bg-[#0b1f3a]"}`}>{toast.m}</div>}
    </div>
  );
}

// Lo mismo que la tarjeta "Customer notices" de la ficha del trabajo: correo, texto, WhatsApp o copiar
function RowNotices({ jobId, onToast, onDone }: { jobId: string; onToast: (m: string, err?: boolean) => void; onDone: () => void }) {
  const n = useCustomerNotices(jobId, 0);
  return <CustomerNotices jobId={jobId} state={n.state} reload={() => { n.reload(); onDone(); }} cancelled={false} onToast={onToast} startOpen="reminder" />;
}

// Franja para los Dashboards: cuántos confirmaron, cuántos no responden y cuántos pidieron otro horario (próximos 7 días)
export function ConfirmationsStrip({ className = "" }: { className?: string }) {
  const [d, setD] = useState<{ total: number; counts: Record<ConfState, number> } | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => fetch("/api/jobs/confirmations", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((r) => { if (live && r && !r.needsSql) setD(r); }).catch(() => null);
    load();
    const t = setInterval(load, 120000);
    return () => { live = false; clearInterval(t); };
  }, []);
  if (!d || !d.total) return null;
  return (
    <section aria-label="Customer confirmations" className={`rounded-2xl border border-slate-200 bg-white px-4 py-3.5 lg:px-5 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link prefetch={false} href="/dashboard/jobs/confirmations" className="group flex min-w-0 items-center gap-3">
          <ConfirmArt size={40} state={d.counts.asked ? "asked" : d.counts.waiting ? "waiting" : "confirmed"} />
          <span className="min-w-0"><span className="block truncate text-[16px] font-semibold leading-tight text-[#0b1f3a] group-hover:text-[#0f766e]">Customer confirmations</span>
            <span className="block text-[12.5px] text-slate-500">Visits in the next 7 days</span></span>
        </Link>
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          {CONF_ORDER.filter((s) => d.counts[s] > 0).map((s) => (
            <Link key={s} prefetch={false} href={`/dashboard/jobs/confirmations?show=${s}`}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 transition-transform hover:-translate-y-0.5 ${CONF_META[s].pill} ${s === "asked" ? "animate-pulse" : ""}`}>
              <span className="text-[15px] leading-none">{d.counts[s]}</span>{CONF_META[s].short}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
