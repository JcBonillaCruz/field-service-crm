"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TeamMember, addDays, dayStart, isoDay, fromIsoDay, receivesJobs } from "@/lib/jobs";
import { OpsGroup, OpsJob } from "@/lib/operations";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";
import DatePicker from "@/components/ui/DatePicker";
import SelectMenu from "@/components/ui/SelectMenu";
import { TechDot } from "@/components/jobs/EventBar";

import { useTranslations } from "next-intl";
import { useJobsTx } from "@/i18n/useJobsTx";
import { useOpsTx } from "@/i18n/useOpsTx";
import { useJobError } from "@/i18n/useFmt";
export type MoveTarget = "unassigned" | "assigned" | "in_progress";
export type OpsAsk =
  | { kind: "move"; job: OpsJob; from: OpsGroup; to: MoveTarget }
  | { kind: "cancel"; job: OpsJob }
  | { kind: "delete"; job: OpsJob };

const REASON_KEYS = ["resched", "part", "notAvail", "notHome", "weather", "other"] as const;
const area = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[14.5px] focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";
const pad = (n: number) => String(n).padStart(2, "0");
const timesFor = (tag: string) => Array.from({ length: 33 }, (_, i) => 6 * 60 + i * 30).map((m) => ({
  value: `${pad(Math.floor(m / 60))}:${pad(m % 60)}`,
  label: new Date(2000, 0, 1, 0, m).toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" }),
}));

// =====================================================================
// Al soltar una tarjeta en otra columna: te decimos qué es lo mejor y pedimos solo lo necesario.
//   · a "Sin asignar": nota obligatoria (por qué) → queda en el historial para los reportes
//   · a "Asignados": si va tarde, sugerimos re-agendar; si no tiene a nadie, eliges quién
//   · a "En progreso": se marca como empezado ahora (útil si el colaborador olvidó darle Start)
// =====================================================================
export function OpsDialog({ ask, team, onClose, onDone }: {
  ask: OpsAsk | null; team: TeamMember[]; onClose: () => void; onDone: (msg: string, notify?: Record<string, unknown>) => void;
}) {
  const t = useTranslations("opsDlg");
  const tc = useTranslations("common");
  const jt = useJobsTx();
  const ox = useOpsTx();
  const jobError = useJobError();
  const TIMES = useMemo(() => timesFor(jt.tag), [jt.tag]);
  const TARGET_LABEL = (k: MoveTarget) => t(`t.${k}` as never);
  const [note, setNote] = useState("");
  const [chip, setChip] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [resched, setResched] = useState(true);
  const [day, setDay] = useState(isoDay(new Date()));
  const [time, setTime] = useState("08:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const job = ask?.job ?? null;
  const delay = job ? ox.delay(job) : null;
  const durMin = job?.visit?.starts_at && job.visit.ends_at ? Math.max(15, Math.round((new Date(job.visit.ends_at).getTime() - new Date(job.visit.starts_at).getTime()) / 60000)) : 60;

  useEffect(() => {
    if (!ask) return;
    setNote(""); setChip(""); setError(""); setBusy(false);
    setPeople(ask.job.techs.map((x) => x.user_id));
    // Re-agendar: mañana a la misma hora si iba tarde (o la próxima media hora de hoy)
    const now = new Date(); const s = ask.job.visit?.starts_at ? new Date(ask.job.visit.starts_at) : null;
    const next = s ? addDays(dayStart(now), 1) : dayStart(now);
    setDay(isoDay(next));
    const base = s ? s.getHours() * 60 + s.getMinutes() : Math.min(19 * 60, Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 30) * 30);
    const m = Math.max(360, Math.min(1320, Math.round(base / 30) * 30));
    setTime(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
    setResched(ask.kind === "move" && ask.from === "delayed" && ask.to === "assigned");
  }, [ask]);

  const choices = useMemo(() => team.filter((m) => receivesJobs(m) || people.includes(m.user_id)), [team, people]);
  if (!ask || !job) return null;
  const name = job.customer_name || `#${job.number}`;
  const fullNote = [chip && chip !== t("r.other") ? chip : "", note.trim()].filter(Boolean).join(" — ");

  // ---------- Cancelar ----------
  if (ask.kind === "cancel") {
    const go = async () => {
      if (!fullNote) return setError(t("whyCancel"));
      setBusy(true);
      const { error: e } = await createClient().rpc("job_cancel", { p_job: job.id, p_reason: fullNote });
      setBusy(false);
      if (e) return setError(jobError(e));
      onDone(t("cancelled", { name }), { jobId: job.id, unassigned: job.techs.map((x) => x.user_id) });
    };
    return (
      <Modal open onClose={onClose} title={t("cancelQ", { name })} footer={<>
        <button type="button" disabled={busy} onClick={go} className="rounded-lg bg-[#be123c] px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#9f1239] disabled:opacity-60">{busy ? t("cancelling") : t("cancelJob")}</button>
        <button type="button" onClick={onClose} className={btnGhost}>{t("keep")}</button></>}>
        <p className="text-[14px] text-slate-600">{t("cancelBody")}</p>
        <Reason chip={chip} setChip={setChip} note={note} setNote={setNote} required />
        {error && <Err text={error} />}
      </Modal>
    );
  }

  // ---------- Eliminar ----------
  if (ask.kind === "delete") {
    const go = async () => {
      if (!fullNote) return setError(t("whyDelete"));
      setBusy(true);
      const { error: e } = await createClient().rpc("ops_delete_job", { p_job: job.id, p_reason: fullNote });
      setBusy(false);
      if (e) return setError(jobError(e));
      onDone(t("deleted", { name }));
    };
    return (
      <Modal open onClose={onClose} title={t("deleteQ", { name })} footer={<>
        <button type="button" disabled={busy} onClick={go} className="rounded-lg bg-[#be123c] px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#9f1239] disabled:opacity-60">{busy ? t("deleting") : t("deleteForever")}</button>
        <button type="button" onClick={onClose} className={btnGhost}>{t("keep")}</button></>}>
        <div className="flex gap-3 rounded-xl border border-[#fecdd3] bg-[#fff7f8] px-4 py-3">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-[#be123c]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
          <p className="text-[14px] text-[#9f1239]">{t.rich("deleteBody", { b: (c) => <b>{c}</b> })}</p>
        </div>
        <Reason chip={chip} setChip={setChip} note={note} setNote={setNote} required />
        {error && <Err text={error} />}
      </Modal>
    );
  }

  // ---------- Mover ----------
  const { from, to } = ask;
  const working = from === "in_progress" || (from === "delayed" && ["on_my_way", "in_progress", "paused"].includes(job.visit?.status ?? ""));
  const noteRequired = to === "unassigned" || (to === "assigned" && working);
  const needsPeople = to !== "unassigned";
  const tip = to === "unassigned"
    ? { title: t("tipUnTitle"), text: t("tipUnText") }
    : to === "in_progress"
      ? { title: from === "delayed" ? t("tipIpBest") : t("tipIpNow"), text: t("tipIpText") }
      : from === "delayed"
        ? { title: t("tipNewDate"), text: t("tipNewDateText", { late: delay ? delay.label.toLowerCase() : t("late") }) }
        : working
          ? { title: t("tipBackTitle"), text: t("tipBackText") }
          : { title: t("tipAssign"), text: t("tipAssignText") };

  const go = async () => {
    setError("");
    if (noteRequired && !fullNote) return setError(to === "unassigned" ? t("whyUn") : t("whyBack"));
    if (needsPeople && !people.length) return setError(t("pickWho"));
    let starts: Date | null = null, ends: Date | null = null;
    if (to === "assigned" && resched) {
      const [h, mm] = time.split(":").map(Number);
      const d = fromIsoDay(day); starts = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mm);
      ends = new Date(starts.getTime() + durMin * 60000);
    }
    setBusy(true);
    const { error: e } = await createClient().rpc("ops_move", {
      p_job: job.id, p_target: to, p_users: needsPeople ? people : null,
      p_starts: starts?.toISOString() ?? null, p_ends: ends?.toISOString() ?? null, p_note: fullNote || null,
    });
    setBusy(false);
    if (e) return setError(jobError(e));
    const before = job.techs.map((x) => x.user_id), after = needsPeople ? people : [];
    onDone(`${name} → ${TARGET_LABEL(to)}`, { jobId: job.id, assigned: after.filter((x) => !before.includes(x)), unassigned: before.filter((x) => !after.includes(x)), moved: Boolean(starts) });
  };

  return (
    <Modal open onClose={onClose} title={t("moveTo", { to: TARGET_LABEL(to) })} width="max-w-xl" footer={<>
      <button type="button" disabled={busy} onClick={go} className={btnPrimary}>{busy ? tc("saving") : to === "in_progress" ? t("markIp") : to === "unassigned" ? t("moveUn") : resched ? t("reschedAssign") : t("moveAssigned")}</button>
      <button type="button" onClick={onClose} className={btnGhost}>{tc("cancel")}</button></>}>
      <p className="text-[13px] font-semibold text-slate-400">#{job.number} · {name}</p>
      <div className="mt-2 flex gap-3 rounded-xl border border-[#d6e4ff] bg-[#f5f8ff] px-4 py-3">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-[#2563eb]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>
        <div><p className="text-[14.5px] font-semibold text-[#0b1f3a]">{tip.title}</p><p className="mt-0.5 text-[13.5px] text-slate-600">{tip.text}</p></div>
      </div>

      {to === "assigned" && from === "delayed" && (
        <div className="mt-4 space-y-2">
          {[[true, t("newDateRec")], [false, t("keepDate")]].map(([v, l]) => (
            <label key={String(v)} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${resched === v ? "border-[#0f766e] bg-[#f3fbf8]" : "border-slate-200 hover:border-slate-300"}`}>
              <input type="radio" checked={resched === v} onChange={() => setResched(Boolean(v))} className="h-4 w-4 accent-[#0f766e]" />
              <span className="text-[14px] font-medium text-[#0b1f3a]">{l as string}</span>
            </label>
          ))}
        </div>
      )}
      {to === "assigned" && resched && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">{t("day")}</p><DatePicker value={day} onChange={setDay} minDate={isoDay(new Date())} /></div>
          <div><p className="mb-1 text-[12.5px] font-medium text-slate-500">{t("startTime")} <span className="font-normal text-slate-400">{t("long", { d: durMin >= 60 ? `${Math.floor(durMin / 60)}h${durMin % 60 ? ` ${durMin % 60}m` : ""}` : `${durMin}m` })}</span></p>
            <SelectMenu ariaLabel={t("startTime")} value={time} onChange={setTime} options={TIMES} /></div>
        </div>
      )}

      {needsPeople && (
        <div className="mt-4">
          <p className="mb-1.5 text-[12.5px] font-semibold text-slate-500">{t("whoDoes")} {people.length > 1 && <span className="font-normal text-slate-400">{t("people", { n: people.length })}</span>}</p>
          {choices.length === 0 ? <p className="text-[13.5px] text-slate-500">{t("noCollabs")}</p> : (
            <div className="flex flex-wrap gap-1.5">
              {choices.map((m) => {
                const on = people.includes(m.user_id);
                return (
                  <button key={m.user_id} type="button" onClick={() => setPeople(on ? people.filter((x) => x !== m.user_id) : [...people, m.user_id])}
                    className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[13px] font-medium transition-all ${on ? "border-[#0f766e] bg-[#e9f7f4] text-[#0f766e]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    <TechDot t={m} size={22} ring={false} />{m.full_name}
                    {on && <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m5 10.5 3 3 7-7" /></svg>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Reason chip={chip} setChip={setChip} note={note} setNote={setNote} required={noteRequired} />
      {error && <Err text={error} />}
    </Modal>
  );
}

function Reason({ chip, setChip, note, setNote, required }: { chip: string; setChip: (v: string) => void; note: string; setNote: (v: string) => void; required: boolean }) {
  const t = useTranslations("opsDlg");
  const tc = useTranslations("common");
  const REASONS = REASON_KEYS.map((k) => t(`r.${k}` as never));
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[12.5px] font-semibold text-slate-500">{t("why")} {required ? <span className="text-[#be123c]">{tc("required")}</span> : <span className="font-normal text-slate-400">{tc("optional")}</span>}</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setChip(chip === r ? "" : r)}
            className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${chip === r ? "border-[#0f766e] bg-[#e9f7f4] text-[#0f766e]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{r}</button>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={chip === t("r.other") || !chip ? t("writeWhat") : t("addDetails")} className={area} />
    </div>
  );
}
const Err = ({ text }: { text: string }) => <p role="alert" className="mt-3 rounded-lg bg-[#fff1f2] px-3 py-2 text-[13.5px] font-medium text-[#be123c]">{text}</p>;
