"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { TeamMember, fromIsoDay, isoDay } from "@/lib/jobs";
import { KIND_META, KIND_OPTIONS, TimeEntry, TimeKind, fmtClock as fmtClockEn, hm } from "@/lib/timesheets";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";
import DatePicker from "@/components/ui/DatePicker";
import SelectMenu from "@/components/ui/SelectMenu";
import SearchSelect from "@/components/ui/SearchSelect";

import { useTranslations } from "next-intl";
import { useJobsTx, useTimeError } from "@/i18n/useJobsTx";
// Qué se abre: corregir un registro que ya existe, o agregar uno que faltó (para una persona y un día)
export type TimeAsk = { entry: TimeEntry } | { add: { userId?: string; day?: string } };

const field = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[15px] text-slate-800 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const at = (day: string, time: string) => { const d = fromIsoDay(day); const [h, m] = time.split(":").map(Number); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 0, m || 0); };
const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-slate-700">{children}</label>;

// La oficina corrige o agrega tiempo. Siempre pide el motivo: el colaborador lo ve en su hoja junto con las horas de antes.
export default function TimeEntryDialog({ ask, companyId, team, canDelete, onClose, onDone }: {
  ask: TimeAsk | null; companyId: string; team: TeamMember[]; canDelete: boolean; onClose: () => void; onDone: (msg: string) => void;
}) {
  const t = useTranslations("timeEdit");
  const tc = useTranslations("common");
  const tk = useTranslations("timesheet");
  const tl = useTranslations("jobsLib");
  const tr = useTranslations("roles");
  const jt = useJobsTx();
  const timeError = useTimeError();
  const fmtClock = (iso: string | null | undefined) => fmtClockEn(iso, jt.tag);
  const REASONS = [t("r1"), t("r2"), t("r3"), t("r4"), t("r5")];
  const kindOptions = KIND_OPTIONS.map((o) => ({ value: o.value, label: tl(`kindOpt.${o.value}` as never) }));
  const kindLabel = (k: TimeKind) => tk(`kind.${k}` as never);
  const entry = ask && "entry" in ask ? ask.entry : null;
  const [userId, setUserId] = useState("");
  const [kind, setKind] = useState<TimeKind>("shift");
  const [day, setDay] = useState(isoDay(new Date()));
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("17:00");
  const [jobId, setJobId] = useState("");
  const [jobs, setJobs] = useState<{ id: string; number: string; customer_name: string }[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ask) return;
    setError(""); setBusy(false); setReason(""); setJobId(""); setJobs([]);
    if ("entry" in ask) {
      const s = new Date(ask.entry.started_at);
      setUserId(ask.entry.user_id); setKind(ask.entry.kind); setDay(isoDay(s)); setStart(hhmm(s));
      setEnd(ask.entry.ended_at ? hhmm(new Date(ask.entry.ended_at)) : "");
    } else {
      setUserId(ask.add.userId ?? ""); setKind("shift"); setDay(ask.add.day ?? isoDay(new Date())); setStart("08:00"); setEnd("17:00");
    }
  }, [ask]);

  // Al agregar traslado / en sitio: se puede amarrar a un trabajo de esa persona (así cuenta en el costo del trabajo)
  useEffect(() => {
    if (!ask || entry || kind === "shift" || !userId) { setJobs([]); return; }
    let live = true;
    createClient().from("v_jobs").select("id, number, customer_name").eq("company_id", companyId).contains("tech_ids", [userId])
      .is("cancelled_at", null).order("job_date", { ascending: false }).limit(60)
      .then(({ data }) => { if (live) setJobs((data ?? []) as { id: string; number: string; customer_name: string }[]); });
    return () => { live = false; };
  }, [ask, entry, kind, userId, companyId]);

  const people = useMemo(() => team.map((m) => ({ value: m.user_id, label: m.full_name, hint: m.role === "technician" ? "" : tr.has(m.role as never) ? tr(m.role as never) : m.role })), [team]);
  if (!ask) return null;

  const startAt = start ? at(day, start) : null;
  let endAt = end ? at(day, end) : null;
  const overnight = Boolean(startAt && endAt && endAt <= startAt);
  if (overnight && endAt) endAt = new Date(endAt.getTime() + 86400000);
  const minutes = startAt && endAt ? (endAt.getTime() - startAt.getTime()) / 60000 : 0;
  const stillOpen = Boolean(entry && !entry.ended_at);
  const who = team.find((m) => m.user_id === (entry?.user_id ?? userId))?.full_name ?? t("thisPerson");

  async function save() {
    setError("");
    if (!entry && !userId) return setError(t("chooseMember"));
    if (!startAt) return setError(t("chooseStart"));
    if (!endAt && !stillOpen) return setError(t("chooseEnd"));
    if (!reason.trim()) return setError(t("needReason"));
    setBusy(true);
    const { error: e } = await createClient().rpc("time_entry_save", {
      p_company: companyId, p_id: entry?.id ?? null, p_user: entry?.user_id ?? userId, p_kind: entry?.kind ?? kind,
      p_started: startAt.toISOString(), p_ended: endAt ? endAt.toISOString() : null, p_reason: reason.trim(), p_job: !entry && kind !== "shift" && jobId ? jobId : null,
    });
    setBusy(false);
    if (e) return setError(timeError(e));
    onDone(entry ? t("corrected", { who }) : t("added", { who }));
  }

  async function remove() {
    if (!entry) return;
    setError("");
    if (!reason.trim()) return setError(t("needReasonDel"));
    if (!(await confirmDelete({
      title: t("deleteQ", { kind: kindLabel(entry.kind).toLowerCase() }), confirmLabel: t("deleteTime"),
      message: t("deleteMsg", { who, from: fmtClock(entry.started_at), to: entry.ended_at ? fmtClock(entry.ended_at) : t("open") }),
    }))) return;
    setBusy(true);
    const { error: e } = await createClient().rpc("time_entry_delete", { p_id: entry.id, p_reason: reason.trim() });
    setBusy(false);
    if (e) return setError(timeError(e));
    onDone(t("deleted", { who }));
  }

  return (
    <Modal open onClose={onClose} title={entry ? t("correctTime") : t("addTime")}
      footer={<>
        <button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? tc("saving") : entry ? t("saveCorrection") : t("addTime")}</button>
        <button type="button" onClick={onClose} className={btnGhost}>{tc("cancel")}</button>
        {entry && canDelete && <button type="button" onClick={remove} disabled={busy} className="ml-auto rounded-lg px-3 py-2.5 text-[14px] font-semibold text-[#be123c] transition-colors hover:bg-[#fff1f2] disabled:opacity-60">{t("deleteEntry")}</button>}
      </>}>
      <div className="space-y-4">
        {entry ? (
          <div className="flex items-center gap-3 rounded-xl px-3.5 py-3" style={{ background: KIND_META[entry.kind].soft }}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: KIND_META[entry.kind].color }} />
            <div className="min-w-0 text-[13.5px] leading-snug">
              <p className="font-semibold text-[#0b1f3a]">{who} · {kindLabel(entry.kind)}{entry.job_number ? ` · ${entry.job_number}` : ""}</p>
              <p className="text-slate-600">{t("recorded", { day: jt.dayShort(new Date(entry.started_at)), from: fmtClock(entry.started_at), to: entry.ended_at ? fmtClock(entry.ended_at) : t("stillOpen") })}</p>
            </div>
          </div>
        ) : (
          <>
            <div><Label>{t("member")}</Label><SearchSelect value={userId} options={people} onChange={setUserId} placeholder={t("searchMember")} ariaLabel={t("member")} /></div>
            <div><Label>{t("kindQ")}</Label><SelectMenu value={kind} options={kindOptions} onChange={(v) => setKind(v as TimeKind)} ariaLabel={t("kindAria")} /></div>
            {kind !== "shift" && (
              <div><Label>{t("job")} <span className="font-normal text-slate-400">{t("optional")}</span></Label>
                <SearchSelect value={jobId} onChange={setJobId} ariaLabel={t("job")}
                  placeholder={!userId ? t("memberFirst") : jobs.length ? t("searchJob") : t("noJobs")}
                  options={jobs.map((j) => ({ value: j.id, label: `${j.number} · ${j.customer_name || t("noCustomer")}` }))} />
              </div>
            )}
          </>
        )}

        <div><Label>{t("day")}</Label><DatePicker value={day} onChange={(v) => v && setDay(v)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="te-start">{kind === "shift" ? t("clockIn") : t("start")}</Label><input id="te-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className={field} /></div>
          <div><Label htmlFor="te-end">{kind === "shift" ? t("clockOut") : t("end")}</Label><input id="te-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={field} /></div>
        </div>
        <p className="-mt-2 text-[12.5px] text-slate-500">
          {!end && stillOpen ? t("noEnd")
            : minutes > 0 ? <>{t.rich("total", { t: hm(minutes), b: (c) => <b className="text-[#0b1f3a]">{c}</b> })}{overnight ? t("nextDay") : ""}</> : " "}
        </p>

        <div>
          <Label htmlFor="te-reason">{t("reason")} <span className="text-red-500">*</span></Label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)}
                className={`rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors ${reason === r ? "border-[#14a39a] bg-[#e9f7f4] text-[#0f766e]" : "border-slate-200 bg-white text-slate-600 hover:border-[#14a39a]"}`}>{r}</button>
            ))}
          </div>
          <textarea id="te-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPh")} className={field} />
          <p className="mt-1 text-[12px] text-slate-500">{t("seesNote", { who: who === t("thisPerson") ? t("theMember") : who, before: entry ? "yes" : "no" })}</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-[13.5px] text-red-700">{error}</p>}
      </div>
    </Modal>
  );
}
