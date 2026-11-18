"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { TeamMember, fromIsoDay, isoDay } from "@/lib/jobs";
import { KIND_META, KIND_OPTIONS, TimeEntry, TimeKind, fmtClock, hm, timeError } from "@/lib/timesheets";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";
import DatePicker from "@/components/ui/DatePicker";
import SelectMenu from "@/components/ui/SelectMenu";
import SearchSelect from "@/components/ui/SearchSelect";

// Qué se abre: corregir un registro que ya existe, o agregar uno que faltó (para una persona y un día)
export type TimeAsk = { entry: TimeEntry } | { add: { userId?: string; day?: string } };

const REASONS = ["Forgot to clock out", "Forgot to clock in", "Forgot to press Start", "Phone had no signal", "Wrong time recorded"];
const field = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[15px] text-slate-800 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const at = (day: string, time: string) => { const d = fromIsoDay(day); const [h, m] = time.split(":").map(Number); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 0, m || 0); };
const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-slate-700">{children}</label>;

// La oficina corrige o agrega tiempo. Siempre pide el motivo: el colaborador lo ve en su hoja junto con las horas de antes.
export default function TimeEntryDialog({ ask, companyId, team, canDelete, onClose, onDone }: {
  ask: TimeAsk | null; companyId: string; team: TeamMember[]; canDelete: boolean; onClose: () => void; onDone: (msg: string) => void;
}) {
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

  const people = useMemo(() => team.map((m) => ({ value: m.user_id, label: m.full_name, hint: m.role === "technician" ? "" : m.role })), [team]);
  if (!ask) return null;

  const startAt = start ? at(day, start) : null;
  let endAt = end ? at(day, end) : null;
  const overnight = Boolean(startAt && endAt && endAt <= startAt);
  if (overnight && endAt) endAt = new Date(endAt.getTime() + 86400000);
  const minutes = startAt && endAt ? (endAt.getTime() - startAt.getTime()) / 60000 : 0;
  const stillOpen = Boolean(entry && !entry.ended_at);
  const who = team.find((m) => m.user_id === (entry?.user_id ?? userId))?.full_name ?? "this person";

  async function save() {
    setError("");
    if (!entry && !userId) return setError("Choose the team member.");
    if (!startAt) return setError("Choose the start time.");
    if (!endAt && !stillOpen) return setError("Choose the end time.");
    if (!reason.trim()) return setError("Write why you are changing this time. The team member will see it.");
    setBusy(true);
    const { error: e } = await createClient().rpc("time_entry_save", {
      p_company: companyId, p_id: entry?.id ?? null, p_user: entry?.user_id ?? userId, p_kind: entry?.kind ?? kind,
      p_started: startAt.toISOString(), p_ended: endAt ? endAt.toISOString() : null, p_reason: reason.trim(), p_job: !entry && kind !== "shift" && jobId ? jobId : null,
    });
    setBusy(false);
    if (e) return setError(timeError(e));
    onDone(entry ? `Time corrected for ${who}.` : `Time added for ${who}.`);
  }

  async function remove() {
    if (!entry) return;
    setError("");
    if (!reason.trim()) return setError("Write why you are deleting this time. It stays in the history.");
    if (!(await confirmDelete({
      title: `Delete this ${KIND_META[entry.kind].label.toLowerCase()} entry?`, confirmLabel: "Delete time",
      message: `${who} · ${fmtClock(entry.started_at)} – ${entry.ended_at ? fmtClock(entry.ended_at) : "open"}. The hours are removed from the timesheet. The history keeps who deleted it, when and why.`,
    }))) return;
    setBusy(true);
    const { error: e } = await createClient().rpc("time_entry_delete", { p_id: entry.id, p_reason: reason.trim() });
    setBusy(false);
    if (e) return setError(timeError(e));
    onDone(`Time deleted for ${who}.`);
  }

  return (
    <Modal open onClose={onClose} title={entry ? "Correct time" : "Add time"}
      footer={<>
        <button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving…" : entry ? "Save correction" : "Add time"}</button>
        <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        {entry && canDelete && <button type="button" onClick={remove} disabled={busy} className="ml-auto rounded-lg px-3 py-2.5 text-[14px] font-semibold text-[#be123c] transition-colors hover:bg-[#fff1f2] disabled:opacity-60">Delete entry</button>}
      </>}>
      <div className="space-y-4">
        {entry ? (
          <div className="flex items-center gap-3 rounded-xl px-3.5 py-3" style={{ background: KIND_META[entry.kind].soft }}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: KIND_META[entry.kind].color }} />
            <div className="min-w-0 text-[13.5px] leading-snug">
              <p className="font-semibold text-[#0b1f3a]">{who} · {KIND_META[entry.kind].label}{entry.job_number ? ` · ${entry.job_number}` : ""}</p>
              <p className="text-slate-600">Recorded: {new Date(entry.started_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, {fmtClock(entry.started_at)} – {entry.ended_at ? fmtClock(entry.ended_at) : "still open"}</p>
            </div>
          </div>
        ) : (
          <>
            <div><Label>Team member</Label><SearchSelect value={userId} options={people} onChange={setUserId} placeholder="Search a team member" ariaLabel="Team member" /></div>
            <div><Label>What kind of time</Label><SelectMenu value={kind} options={KIND_OPTIONS} onChange={(v) => setKind(v as TimeKind)} ariaLabel="Kind of time" /></div>
            {kind !== "shift" && (
              <div><Label>Job <span className="font-normal text-slate-400">(optional)</span></Label>
                <SearchSelect value={jobId} onChange={setJobId} ariaLabel="Job"
                  placeholder={!userId ? "Choose the team member first" : jobs.length ? "Search a job of this person" : "No jobs found for this person"}
                  options={jobs.map((j) => ({ value: j.id, label: `${j.number} · ${j.customer_name || "No customer"}` }))} />
              </div>
            )}
          </>
        )}

        <div><Label>Day</Label><DatePicker value={day} onChange={(v) => v && setDay(v)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="te-start">{kind === "shift" ? "Clock in" : "Start"}</Label><input id="te-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className={field} /></div>
          <div><Label htmlFor="te-end">{kind === "shift" ? "Clock out" : "End"}</Label><input id="te-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={field} /></div>
        </div>
        <p className="-mt-2 text-[12.5px] text-slate-500">
          {!end && stillOpen ? "No end time: it keeps running. Fill it in to close a missed clock-out."
            : minutes > 0 ? <>Total: <b className="text-[#0b1f3a]">{hm(minutes)}</b>{overnight ? " · ends the next day" : ""}</> : " "}
        </p>

        <div>
          <Label htmlFor="te-reason">Reason <span className="text-red-500">*</span></Label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)}
                className={`rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors ${reason === r ? "border-[#14a39a] bg-[#e9f7f4] text-[#0f766e]" : "border-slate-200 bg-white text-slate-600 hover:border-[#14a39a]"}`}>{r}</button>
            ))}
          </div>
          <textarea id="te-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this time being changed?" className={field} />
          <p className="mt-1 text-[12px] text-slate-500">{who === "this person" ? "The team member" : who} sees this note on their timesheet, with your name{entry ? " and the hours recorded before" : ""}.</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-[13.5px] text-red-700">{error}</p>}
      </div>
    </Modal>
  );
}
