"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { useTranslations } from "next-intl";
import { r2 } from "@/lib/finance-period";
import { useFinTx } from "@/i18n/useFinTx";
import { FREQUENCIES, Frequency, Recurring, catchUpCount, monthlyOf, needsFinancingSql } from "@/lib/financing";
import { CATEGORIES } from "@/components/expenses/ExpensesWorkspace";
import SelectMenu from "@/components/ui/SelectMenu";
import DatePicker from "@/components/ui/DatePicker";
import { Kpi, card, ghostBtn, tealBtn } from "@/components/finances/FinBits";
import { LeadSourceSelect } from "@/components/customers/LeadSourcePicker";
import type { LeadSource } from "@/lib/lead-sources";
import { MARKETING_CATEGORY } from "@/lib/marketing-roi";

const inputClass = "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";
const catOf = (name: string) => CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[CATEGORIES.length - 1];

// Paso 6.2b: en el idioma de quien lo ve
function useRecTx() {
  const t = useTranslations("recurring");
  const fx = useFinTx();
  const dayLong = (iso: string | null) => {
    if (!iso) return "—";
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(fx.tag, { month: "short", day: "numeric", year: "numeric" }).replace(".", "");
  };
  const err = (e: { message?: string; code?: string; hint?: string } | null | undefined) =>
    !e ? "" : needsFinancingSql(e) ? t("eSql") : (e.message ?? "").includes("NO_ACCESS") ? t("eNoAccess") : e.hint && fx.locale === "en" ? e.hint : t("eGeneric");
  return { t, fx, money: fx.money, dayLong, err, freq: (f: Frequency) => t(`f_${f}`), every: (f: Frequency) => t(`e_${f}`) };
}
const COLS = "lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto]";

// Finances → Recurring expenses (Paso 5.10d): renta, seguro, software… Se guarda una vez y el gasto se crea solo en su fecha.
// Lo usan los mismos que usan Expenses (dueño, manager y oficina).
export default function RecurringWorkspace({ companyId, actor, today, rows, needsSql }: { companyId: string; actor: string; today: string; rows: Recurring[]; needsSql: boolean }) {
  const { t, fx, money, dayLong, err, freq } = useRecTx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<Recurring | "new" | null>(null);
  const [note, setNote] = useState("");
  const [fail, setFail] = useState("");
  const refresh = (msg: string) => { setForm(null); setNote(msg); setFail(""); start(() => router.refresh()); };
  useEffect(() => { if (!note) return; const k = setTimeout(() => setNote(""), 4000); return () => clearTimeout(k); }, [note]);

  const active = rows.filter((r) => r.is_active);
  const perMonth = r2(active.reduce((a, r) => a + monthlyOf(r), 0));
  const next = [...active].sort((a, b) => a.next_date.localeCompare(b.next_date))[0];

  async function toggle(r: Recurring) {
    // Al reanudar no se crean de golpe los meses en pausa: sigue desde la próxima fecha que viene
    let patch: Partial<Recurring> = { is_active: !r.is_active };
    if (!r.is_active && r.next_date < today) {
      let runs = r.runs, nd = r.next_date;
      for (let i = 0; i < 600 && nd < today; i++) { runs += 1; nd = stepDate(r.start_date, r.frequency, runs); }
      patch = { ...patch, runs, next_date: nd };
    }
    const { error } = await createClient().from("recurring_expenses").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (error) return setFail(err(error));
    refresh(r.is_active ? t("paused") : t("activeAgain"));
  }
  async function remove(r: Recurring) {
    if (!(await confirmDelete({ title: t("delTitle", { name: r.vendor || fx.cat(r.category) }), message: t("delMsg"), download: { filename: `recurring-${r.vendor || r.category}`, data: r } }))) return;
    const { error } = await createClient().from("recurring_expenses").delete().eq("id", r.id);
    if (error) return setFail(err(error));
    refresh(t("deleted"));
  }

  if (form) return <RecurringForm companyId={companyId} actor={actor} today={today} item={form === "new" ? null : form} onCancel={() => setForm(null)} onDone={refresh} />;

  const cell = (label: string, value: React.ReactNode) => (
    <span className="min-w-0"><span className="block text-[11px] font-medium text-slate-400 lg:hidden">{label}</span><span className="block truncate text-[13.5px] tabular-nums text-slate-700">{value}</span></span>
  );
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f4f6f8] px-3 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{t("title")}</h1>
          <p className="text-[13px] text-slate-500">{t("subtitle")}</p>
        </div>
        {!needsSql && <button type="button" onClick={() => setForm("new")} className={tealBtn}>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("newBtn")}
        </button>}
      </div>
      {note && <p role="status" className="mt-3 animate-[bp-fade_0.2s_ease-out] rounded-xl border border-[#b7e4c7] bg-[#f0fbf4] px-4 py-2.5 text-[13.5px] font-medium text-[#15803d]">{note}</p>}
      {fail && <p role="alert" className="mt-3 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-2.5 text-[13.5px] text-[#be123c]">{fail}</p>}

      {needsSql ? (
        <div className={`${card} mt-5 px-5 py-10 text-center`}>
          <p className="text-[15px] font-semibold text-[#0b1f3a]">{t("oneStep")}</p>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] text-slate-500">{t.rich("runSql", { b: (c) => <b>{c}</b> })}</p>
        </div>
      ) : (
        <div className={`transition-opacity duration-200 ${pending ? "opacity-60" : ""}`}>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
            <Kpi art="idle" title={t("kFixed")} value={money(perMonth)} hint={t("kFixedHint")} />
            <Kpi art="done" title={t("kActive")} value={String(active.length)} hint={rows.length - active.length ? t("kPaused", { n: rows.length - active.length }) : t("kActiveHint")} />
            <div className="col-span-2 xl:col-span-1"><Kpi art="ontime" title={t("kNext")} value={next ? dayLong(next.next_date) : "—"} hint={next ? `${next.vendor || fx.cat(next.category)} · ${money(next.amount)}` : t("kNothing")} /></div>
          </div>
          {rows.length === 0 ? (
            <div className={`${card} mt-4 px-5 py-12 text-center`}>
              <p className="text-[15px] font-semibold text-[#0b1f3a]">{t("emptyTitle")}</p>
              <p className="mx-auto mt-1 max-w-md text-[13.5px] text-slate-500">{t("emptyText")}</p>
              <button type="button" onClick={() => setForm("new")} className={`${tealBtn} mt-4`}>{t("addFirst")}</button>
            </div>
          ) : (
            <section className={`${card} mt-4 overflow-hidden`}>
              <div className={`hidden items-center gap-x-3 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:grid ${COLS}`}><span>{t("expense")}</span><span>{t("amount")}</span><span>{t("repeats")}</span><span>{t("nextDate")}</span><span>{t("lastCreated")}</span><span className="w-[13.5rem]" /></div>
              <ul className="divide-y divide-slate-100">
                {rows.map((r) => { const c = catOf(r.category); return (
                  <li key={r.id} className={`grid grid-cols-2 items-center gap-x-3 gap-y-2.5 px-3.5 py-3 lg:px-5 ${COLS} ${r.is_active ? "" : "bg-slate-50/70"}`}>
                    <span className="col-span-2 flex min-w-0 items-center gap-2.5 lg:col-span-1">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${c.color}18`, color: c.color, opacity: r.is_active ? 1 : 0.5 }}>
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg></span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-[#0b1f3a]">{r.vendor || fx.cat(r.category)}{!r.is_active && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{r.end_date && r.next_date > r.end_date ? t("finished") : t("pausedTag")}</span>}</span>
                        <span className="block truncate text-[12px] text-slate-400">{[r.vendor ? fx.cat(r.category) : null, r.payment_mode ? fx.pay(r.payment_mode) : null, r.notes].filter(Boolean).join(" · ") || "—"}</span>
                      </span>
                    </span>
                    {cell(t("amount"), <b className="font-semibold text-[#0b1f3a]">{money(r.amount)}</b>)}
                    {cell(t("repeats"), freq(r.frequency))}
                    {cell(t("nextDate"), r.is_active ? dayLong(r.next_date) : "—")}
                    {cell(t("lastCreated"), r.last_run ? dayLong(r.last_run) : t("notYet"))}
                    <span className="col-span-2 flex items-center gap-1 lg:col-span-1 lg:w-[13.5rem] lg:justify-end">
                      {!(r.end_date && r.next_date > r.end_date) && <button type="button" onClick={() => toggle(r)} className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-100">{r.is_active ? t("pause") : t("resume")}</button>}
                      <button type="button" onClick={() => setForm(r)} className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">{t("edit")}</button>
                      <button type="button" onClick={() => remove(r)} className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[#be123c] hover:bg-[#fff1f2]">{t("delete")}</button>
                    </span>
                  </li>
                ); })}
              </ul>
            </section>
          )}
          <p className="mt-4 text-[12.5px] leading-relaxed text-slate-500">
            {t.rich("footer", { ex: (c) => <Link prefetch={false} href="/dashboard/expenses" className="font-semibold text-[#0f766e] hover:underline">{c}</Link> })}
          </p>
        </div>
      )}
    </div>
  );
}

// La fecha número "runs" contando desde la primera (el día se conserva: 31 → fin de mes cuando no existe)
function stepDate(start: string, f: Frequency, runs: number): string {
  const [y, m, d] = start.split("-").map(Number);
  if (f === "weekly") return new Date(Date.UTC(y, m - 1, d + 7 * runs)).toISOString().slice(0, 10);
  const months = f === "yearly" ? runs * 12 : runs;
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
}

function RecurringForm({ companyId, actor, today, item, onCancel, onDone }: { companyId: string; actor: string; today: string; item: Recurring | null; onCancel: () => void; onDone: (msg: string) => void }) {
  const { t, fx, money, dayLong, err, freq, every } = useRecTx();
  const [category, setCategory] = useState(item?.category ?? "Rent & Utilities");
  const [vendor, setVendor] = useState(item?.vendor ?? "");
  const [amount, setAmount] = useState(item ? String(item.amount) : "");
  const [frequency, setFrequency] = useState<Frequency>(item?.frequency ?? "monthly");
  const [date, setDate] = useState(item?.next_date ?? today);
  const [end, setEnd] = useState(item?.end_date ?? "");
  const [mode, setMode] = useState(item?.payment_mode ?? "Bank Transfer");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Paso 6.16-M: un gasto de Marketing que se repite (agencia SEO, Google Ads…) lleva su fuente de clientes
  const [leadSource, setLeadSource] = useState(item?.lead_source_id ?? "");
  const [sources, setSources] = useState<LeadSource[] | null>(null);
  const isMarketing = category === MARKETING_CATEGORY;
  useEffect(() => {
    if (!isMarketing || sources) return;
    let alive = true;
    createClient().from("lead_sources").select("id, code, name, is_active, position").eq("company_id", companyId).order("position").order("created_at")
      .then(({ data }) => { if (alive) setSources((data ?? []) as LeadSource[]); });
    return () => { alive = false; };
  }, [isMarketing, sources, companyId]);
  // Cambió la fecha o cada cuánto: la cuenta empieza de nuevo desde esa fecha
  const rescheduled = !item || date !== item.next_date || frequency !== item.frequency;
  const back = rescheduled ? catchUpCount(date, frequency, today, end || null) : 0;

  async function save() {
    const a = r2(Number(amount.replace(/[^0-9.]/g, "")));
    if (!a) return setError(t("eAmount"));
    if (!date) return setError(t("eDate"));
    if (end && end < date) return setError(t("eEnd"));
    setBusy(true); setError("");
    const sb = createClient();
    const base = { category, vendor: vendor.trim() || null, amount: a, payment_mode: mode, notes: notes.trim() || null, frequency, end_date: end || null, updated_at: new Date().toISOString() };
    const sched = rescheduled ? { start_date: date, next_date: date, runs: 0, is_active: true } : {};
    const put = (b: Record<string, unknown>) => item
      ? sb.from("recurring_expenses").update({ ...b, ...sched }).eq("id", item.id)
      : sb.from("recurring_expenses").insert({ ...b, ...sched, company_id: companyId, created_by_name: actor });
    let { error: e } = await put({ ...base, lead_source_id: isMarketing && leadSource ? leadSource : null });
    if (e && /lead_source_id/i.test(e.message ?? "")) ({ error: e } = await put(base)); // sin el SQL 6.16-M se guarda sin la fuente
    if (e) { setBusy(false); return setError(err(e)); }
    // Si ya toca (hoy o una fecha que ya pasó), el gasto se crea de una vez
    await sb.rpc("recurring_expenses_run", { p_company: companyId, p_today: today }).then(() => null, () => null);
    onDone(back > 0 ? t("savedBack", { n: back }) : t("savedLater"));
  }
  const field = (label: string, hint: string | null, child: React.ReactNode, wide = false) => (
    <div className={wide ? "sm:col-span-2" : ""}><p className="mb-1 text-[12.5px] font-medium text-slate-600">{label}{hint && <span className="font-normal text-slate-400"> · {hint}</span>}</p>{child}</div>
  );
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-white">
      <div className="border-b border-slate-200 px-4 py-4 lg:px-8">
        <h1 className="text-[20px] font-semibold text-[#0b1f3a]">{item ? t("editTitle") : t("newBtn")}</h1>
        <p className="text-[13px] text-slate-500">{t("formSub", { every: every(frequency) })}</p>
      </div>
      <div className="grid w-full max-w-3xl flex-1 content-start gap-4 px-4 py-5 sm:grid-cols-2 lg:px-8">
        {field(t("category"), null, <SelectMenu ariaLabel={t("category")} value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c.name, label: fx.cat(c.name) }))} />)}
        {isMarketing && field(t("leadSource"), t("optional"), sources ? (
          <LeadSourceSelect id="rec-lead-source" companyId={companyId} sources={sources} value={leadSource} onChange={setLeadSource}
            onCreated={(s) => setSources((l) => [...(l ?? []), s])} />
        ) : <div className="h-10 animate-pulse rounded-lg bg-slate-100" />)}
        {field(t("paidTo"), t("optional"), <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder={t("paidToPh")} aria-label={t("paidTo")} className={inputClass} />)}
        {field(t("amount"), t("eachTime"), <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-label={t("amount")} autoFocus={!item} className={`${inputClass} pl-7`} /></div>)}
        {field(t("repeats"), null, <SelectMenu ariaLabel={t("repeats")} value={frequency} onChange={(v) => setFrequency(v as Frequency)} options={FREQUENCIES.map((f) => ({ value: f.value, label: freq(f.value) }))} />)}
        {field(item ? t("nextDate") : t("firstDate"), t("dayRepeats"), <DatePicker value={date} onChange={setDate} />)}
        {field(t("endsOn"), t("optional"), <DatePicker value={end} onChange={setEnd} minDate={date || undefined} />)}
        {field(t("paidWith"), null, <SelectMenu ariaLabel={t("paidWith")} value={mode} onChange={setMode} options={fx.payModes} />)}
        {field(t("notes"), t("optional"), <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPh")} aria-label={t("notes")} className={inputClass} />)}
        {back > 0 && (
          <p className={`rounded-xl border px-4 py-3 text-[13px] sm:col-span-2 ${back > 1 ? "border-[#fcd38d] bg-[#fffbf3] text-[#92400e]" : "border-[#b7e4c7] bg-[#f0fbf4] text-[#15803d]"}`}>
            {back > 1 ? t("backMany", { n: back, every: every(frequency), date: dayLong(date), total: money(back * r2(Number(amount.replace(/[^0-9.]/g, "")))) })
              : t("backOne")}
          </p>
        )}
      </div>
      <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={busy} className={tealBtn}>{busy ? t("saving") : t("save")}</button>
          <button type="button" onClick={onCancel} disabled={busy} className={ghostBtn}>{t("cancel")}</button>
          {error && <p role="alert" className="min-w-0 text-[13px] text-[#be123c]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
