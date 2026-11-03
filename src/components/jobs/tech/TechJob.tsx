"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/components/catalog/BarcodeScanner";
import { inputClass } from "@/components/customers/ui";
import {
  HOLD_REASONS, SiteAddress, TechChip, VISIT_LABEL, VisitStatus, addMinutes, addressLine, fmtDayShort, fmtTime, holdLabel, jobError, mapsLink, usd,
} from "@/lib/jobs";
import { StatusArt, TechDot } from "@/components/jobs/EventBar";

type Visit = { id: string; visit_no: number; status: VisitStatus; starts_at: string | null; ends_at: string | null; arrival_window_min: number; techs: TechChip[]; started_at: string | null };
type Line = { id: string; name: string; description: string | null; quantity: number; unit: string | null; kind: string; source: string; rate?: number; amount?: number };
type Check = { id: string; label: string; is_required: boolean; done: boolean; done_by_name: string | null };
type Part = { movement_id: string; name: string; sku: string | null; qty: number; at: string; by: string | null };
type Ev = { id: string; kind: string; message: string; detail: string | null; actor_name: string | null; created_at: string };
type Data = {
  job: { id: string; company_id: string; number: string; status: string; title: string | null; description: string | null; tech_notes: string | null; customer_name: string; customer_phone: string | null; site_address: SiteAddress; hold_reason: string | null; estimated_total: number | null };
  prices_visible: boolean; type: { name: string; color: string; form_kind: string } | null;
  visits: Visit[]; lines: Line[]; checklist: Check[]; parts: Part[]; events: Ev[];
};
type Stock = { item_id: string; name: string; sku: string | null; unit: string | null; image_url: string | null; location_id: string; qty: number };

const Icon = ({ d, className = "h-5 w-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const card = "rounded-2xl border border-slate-200 bg-white";

async function gps(): Promise<GeolocationPosition | null> {
  return new Promise((ok) => (navigator.geolocation ? navigator.geolocation.getCurrentPosition(ok, () => ok(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }) : ok(null)));
}

// Técnico: el trabajo completo con los botones On my way · Start · Pause · Can't finish · Finish
export default function TechJob({ jobId, companyId, userId }: { jobId: string; companyId: string; userId: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [holdOpen, setHoldOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [holdNote, setHoldNote] = useState("");
  const [partOpen, setPartOpen] = useState(false);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const { data, error: e } = await createClient().rpc("tech_job", { p_job: jobId });
    if (e) { setError(jobError(e)); return; }
    setD(data as Data); setError("");
  }, [jobId]);
  useEffect(() => { load(); }, [load]);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? "" : t)), 2800); };

  // Mi visita: la que tengo abierta, o la siguiente que me toca
  const visit = useMemo(() => {
    if (!d) return null;
    const mine = d.visits.filter((v) => v.techs.some((t) => t.user_id === userId));
    return mine.find((v) => ["on_my_way", "in_progress", "paused"].includes(v.status)) ?? mine.find((v) => v.status === "scheduled")
      ?? mine.find((v) => v.status === "unscheduled") ?? mine[mine.length - 1] ?? null;
  }, [d, userId]);

  async function act(action: "on_my_way" | "start" | "resume" | "pause" | "hold" | "finish") {
    if (!visit) return;
    if (action === "finish" && !window.confirm("Finish this job?")) return;
    setBusy(action); setError("");
    const pos = action === "pause" ? null : await gps();
    const { error: e } = await createClient().rpc("tech_action", {
      p_visit: visit.id, p_action: action, p_lat: pos?.coords.latitude ?? null, p_lng: pos?.coords.longitude ?? null,
      p_accuracy: pos?.coords.accuracy ?? null, p_reason: action === "hold" ? reason || null : null, p_note: action === "hold" ? holdNote.trim() || null : null,
    });
    setBusy("");
    if (e) { setError(e.hint || jobError(e)); return; }
    // Aviso a la oficina (campana + push): para que el dueño sepa al momento y pueda cobrar antes de que te vayas
    fetch("/api/jobs/tech-event", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitId: visit.id, action }) }).catch(() => null);
    if (action === "hold") { setHoldOpen(false); setReason(""); setHoldNote(""); }
    flash({ on_my_way: "On your way. The customer and office can see it.", start: "Job started", resume: "Work resumed", pause: "Paused", hold: "Sent to the office to schedule the next visit", finish: "Job finished. Great work!" }[action]);
    load();
  }
  // Regresar a un trabajo que quedó a medias (ya llegó la pieza, etc.)
  async function resumeHold() {
    if (!visit) return;
    setBusy("back"); setError("");
    const pos = await gps();
    const { error: e } = await createClient().rpc("tech_resume_hold", { p_visit: visit.id, p_lat: pos?.coords.latitude ?? null, p_lng: pos?.coords.longitude ?? null, p_accuracy: pos?.coords.accuracy ?? null });
    setBusy("");
    if (e) { setError(e.hint || jobError(e)); return; }
    fetch("/api/jobs/tech-event", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitId: visit.id, action: "resume" }) }).catch(() => null);
    flash("Back on the job. Your time is running again.");
    load();
  }
  async function toggle(c: Check) {
    setD((x) => x && ({ ...x, checklist: x.checklist.map((k) => (k.id === c.id ? { ...k, done: !k.done } : k)) }));
    const { error: e } = await createClient().rpc("tech_check", { p_item: c.id, p_done: !c.done, p_visit: visit?.id ?? null });
    if (e) { setError(jobError(e)); load(); }
  }
  async function addNote() {
    if (!note.trim()) return;
    setBusy("note");
    const { error: e } = await createClient().rpc("tech_add_note", { p_job: jobId, p_text: note.trim(), p_visit: visit?.id ?? null });
    setBusy("");
    if (e) return setError(jobError(e));
    setNote(""); load();
  }

  if (error && !d) return <div className="mx-auto max-w-2xl px-4 py-10"><p className="rounded-xl bg-red-50 px-4 py-3 text-red-700">{error}</p><Link href="/dashboard/jobs/mine" className="mt-4 inline-block font-semibold text-[#0f766e]">← My jobs</Link></div>;
  if (!d) return <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div>;

  const j = d.job;
  const s = visit?.starts_at ? new Date(visit.starts_at) : null, e = visit?.ends_at ? new Date(visit.ends_at) : null;
  const maps = mapsLink(j.site_address), addr = addressLine(j.site_address);
  const st = visit?.status ?? "scheduled";
  const canWork = ["on_my_way", "in_progress", "paused"].includes(st);
  // Terminado o cancelado: se puede ver todo, pero ya no se cambia nada
  const readOnly = st === "completed" || st === "cancelled";
  const doneAt = (visit as (Visit & { finished_at?: string | null }) | null)?.finished_at;
  const missing = d.checklist.filter((c) => c.is_required && !c.done).length;
  const notes = d.events.filter((x) => x.kind === "note").reverse();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-40 pt-3 lg:pt-6">
      <Link prefetch={false} href="/dashboard/jobs/mine" className="inline-flex items-center gap-1 rounded-lg py-1 text-[14px] font-semibold text-[#0f766e]">
        <Icon d="m15 6-6 6 6 6" className="h-4 w-4" /> My jobs
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-slate-500">#{j.number}{visit && d.visits.length > 1 ? ` · Visit ${visit.visit_no} of ${d.visits.length}` : ""}</p>
          <h1 className="truncate text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{j.customer_name || "Job"}</h1>
          <p className="text-[14px] text-slate-600">{[d.type?.name, j.title].filter(Boolean).join(" · ")}</p>
        </div>
        <span className="mt-1 shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-700">{VISIT_LABEL[st]}</span>
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</p>}
      {st === "completed" && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3">
          <StatusArt s="completed" size={36} />
          <div><p className="text-[15px] font-semibold text-[#15803d]">Completed</p>
            <p className="text-[13px] text-slate-600">{doneAt ? `Finished ${new Date(doneAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. ` : ""}This job is closed and can&apos;t be changed.</p></div>
        </div>
      )}

      {/* Cuándo, dónde y contacto */}
      <div className={`${card} mt-4 divide-y divide-slate-100`}>
        {s && e && (
          <div className="flex gap-3 px-4 py-3"><span className="text-slate-400"><Icon d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" /></span>
            <div><p className="font-semibold text-[#0b1f3a]">{fmtDayShort(s)} · {fmtTime(s)} – {fmtTime(e)}</p>
              {visit && visit.arrival_window_min > 0 && <p className="text-[13px] text-slate-500">Customer expects you between {fmtTime(s)} and {fmtTime(addMinutes(s, visit.arrival_window_min))}</p>}</div></div>
        )}
        {addr && (
          <a href={maps ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
            <span className="text-slate-400"><Icon d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /></span>
            <span className="min-w-0 flex-1 text-[14.5px] text-[#0b1f3a]">{addr}</span>
            <span className="shrink-0 rounded-lg bg-[#e9f7f4] px-2.5 py-1.5 text-[13px] font-semibold text-[#0f766e]">Directions</span>
          </a>
        )}
        {j.customer_phone && (
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-slate-400"><Icon d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></span>
            <span className="flex-1 text-[14.5px] text-[#0b1f3a]">{j.customer_phone}</span>
            <a href={`sms:${j.customer_phone.replace(/[^\d+]/g, "")}`} className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[#0f766e] active:bg-[#f3fbf8]">Text</a>
            <a href={`tel:${j.customer_phone.replace(/[^\d+]/g, "")}`} className="rounded-lg bg-[#e9f7f4] px-2.5 py-1.5 text-[13px] font-semibold text-[#0f766e]">Call</a>
          </div>
        )}
        {visit && visit.techs.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-[13.5px] text-slate-600">With: {visit.techs.filter((t) => t.user_id !== userId).map((t) => <span key={t.user_id} className="flex items-center gap-1.5"><TechDot t={t} size={20} ring={false} />{t.name}</span>)}</div>
        )}
      </div>

      {j.tech_notes && (
        <div className="mt-3 rounded-2xl border border-[#fde3b4] bg-[#fffaf0] px-4 py-3">
          <p className="text-[12.5px] font-semibold text-[#b45309]">Notes from the office</p>
          <p className="mt-0.5 whitespace-pre-line text-[14.5px] text-[#0b1f3a]">{j.tech_notes}</p>
        </div>
      )}
      {j.description && <div className={`${card} mt-3 px-4 py-3`}><p className="text-[12.5px] font-semibold text-slate-500">Job details</p><p className="mt-0.5 whitespace-pre-line text-[14.5px] text-[#0b1f3a]">{j.description}</p></div>}
      {st === "on_hold" && (
        <div className="mt-3 rounded-2xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3">
          <p className="text-[14px] font-semibold text-[#be123c]">Left for follow-up: {holdLabel(j.hold_reason)}</p>
          <p className="mt-0.5 text-[13px] text-[#be123c]/80">The office can schedule the next visit, or if you&apos;re back at the job now (the part arrived), continue it here.</p>
          <button type="button" onClick={resumeHold} disabled={busy === "back"}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f766e] py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(15,118,110,0.25)] active:scale-[0.98] disabled:opacity-60">
            {busy === "back" ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon d="M8 5v14l11-7z" />}I&apos;m back — continue this job
          </button>
        </div>
      )}

      {/* Checklist */}
      {d.checklist.length > 0 && (
        <div className={`${card} mt-3 px-4 py-3`}>
          <div className="flex items-center justify-between"><p className="text-[15px] font-semibold text-[#0b1f3a]">Checklist</p>
            {missing > 0 ? <span className="text-[12px] font-semibold text-[#be123c]">{missing} required left</span> : <span className="text-[12px] font-semibold text-[#0f766e]">All done</span>}</div>
          <div className="mt-2 space-y-1">
            {d.checklist.map((c) => (
              <button key={c.id} type="button" onClick={() => !readOnly && toggle(c)} disabled={readOnly} className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left active:bg-slate-50 disabled:cursor-default">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${c.done ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-slate-300"}`}>
                  {c.done && <Icon d="m5 12.5 4.5 4.5L19 7" className="h-4 w-4" />}
                </span>
                <span className={`flex-1 text-[15px] ${c.done ? "text-slate-400 line-through" : "text-[#0b1f3a]"}`}>{c.label}</span>
                {c.is_required && !c.done && <span className="text-[11px] font-semibold text-[#be123c]">Required</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Servicios y piezas */}
      <div className={`${card} mt-3 px-4 py-3`}>
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold text-[#0b1f3a]">Services &amp; parts</p>
          {canWork && <button type="button" onClick={() => setPartOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 py-1.5 text-[13.5px] font-semibold text-white active:scale-95">
            <Icon d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 8v8M11 8v8M14 8v8M17 8v8" className="h-4 w-4" />Use a part</button>}
        </div>
        {d.lines.length === 0 ? <p className="mt-2 text-[13.5px] text-slate-500">Nothing yet. Parts you use from your van are added here.</p> : (
          <div className="mt-2 divide-y divide-slate-100">
            {d.lines.map((l) => (
              <div key={l.id} className="flex items-center gap-3 py-2">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${l.kind === "material" ? "bg-[#fff7e6] text-[#d97706]" : "bg-[#eef4ff] text-[#2563eb]"}`}>
                  <Icon d={l.kind === "material" ? "M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9" : "M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-2.4z"} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] text-[#0b1f3a]">{l.name}</span>
                  <span className="text-[12px] text-slate-500">Qty {Number(l.quantity)}{l.unit ? ` ${l.unit}` : ""}{l.source === "scan" ? " · from your van" : ""}</span></span>
                {d.prices_visible && l.amount != null && <span className="text-[14px] font-semibold text-[#0b1f3a]">{usd(l.amount)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notas */}
      <div className={`${card} mt-3 px-4 py-3`}>
        <p className="text-[15px] font-semibold text-[#0b1f3a]">Notes</p>
        {!readOnly && <div className="mt-2 flex gap-2">
          <input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="What you found or did" className={inputClass} />
          <button type="button" onClick={addNote} disabled={busy === "note"} className="shrink-0 rounded-lg border border-slate-200 px-4 text-[14px] font-semibold text-[#0f766e] disabled:opacity-60">Add</button>
        </div>}
        {readOnly && notes.length === 0 && <p className="mt-1 text-[13.5px] text-slate-400">No notes.</p>}
        {notes.map((n) => (
          <div key={n.id} className="mt-2 rounded-xl bg-slate-50 px-3 py-2"><p className="text-[14px] text-[#0b1f3a]">{n.detail}</p>
            <p className="text-[11.5px] text-slate-400">{n.actor_name} · {new Date(n.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p></div>
        ))}
      </div>

      {/* Botones del trabajo (abajo, grandes, fáciles de tocar) */}
      {visit && !["completed", "cancelled", "on_hold", "unscheduled"].includes(st) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            {st === "scheduled" && <Big onClick={() => act("on_my_way")} busy={busy === "on_my_way"} tone="violet" icon="M3 12h11V6H3zM14 9h3l3 3v3h-6M7 18a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 7 18zM17 18a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z">On my way</Big>}
            {(st === "scheduled" || st === "on_my_way") && <Big onClick={() => act("start")} busy={busy === "start"} tone={st === "on_my_way" ? "teal" : "light"} icon="M8 5v14l11-7z">Start job</Big>}
            {st === "paused" && <Big onClick={() => act("resume")} busy={busy === "resume"} tone="teal" icon="M8 5v14l11-7z">Resume</Big>}
            {(st === "in_progress" || st === "paused") && <Big onClick={() => act("finish")} busy={busy === "finish"} tone={st === "in_progress" ? "teal" : "light"} icon="M5 12.5 9.5 17 19 7">Finish job{missing ? ` (${missing} tasks left)` : ""}</Big>}
            {(st === "in_progress" || st === "paused" || st === "on_my_way") && (
              <div className="flex gap-2">
                {st === "in_progress" && <button type="button" onClick={() => act("pause")} disabled={!!busy} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[14px] font-semibold text-slate-700 active:scale-[0.98]">Pause</button>}
                <button type="button" onClick={() => setHoldOpen(true)} disabled={!!busy} className="flex-1 rounded-xl border border-[#fecdd3] bg-[#fff1f2] py-2.5 text-[14px] font-semibold text-[#be123c] active:scale-[0.98]">Can&apos;t finish today</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dejar a medias: motivo + nota */}
      {holdOpen && (
        <Sheet title="Can't finish today?" onClose={() => setHoldOpen(false)}>
          <p className="text-[13.5px] text-slate-500">Your time stops and the office gets an alert to schedule the next visit. Everything you did and the parts you used stay on the job.</p>
          <div className="mt-3 grid gap-2">
            {HOLD_REASONS.map((r) => (
              <button key={r.value} type="button" onClick={() => setReason(r.value)}
                className={`rounded-xl border px-4 py-3 text-left text-[15px] font-medium ${reason === r.value ? "border-[#be123c] bg-[#fff1f2] text-[#be123c]" : "border-slate-200 text-[#0b1f3a]"}`}>{r.label}</button>
            ))}
          </div>
          <textarea value={holdNote} onChange={(ev) => setHoldNote(ev.target.value)} rows={3} placeholder={reason === "waiting_part" ? "Which part is needed? (model, size)" : "Note for the office"} className={`${inputClass} mt-3 resize-none`} />
          <button type="button" onClick={() => act("hold")} disabled={!reason || busy === "hold"} className="mt-3 w-full rounded-xl bg-[#be123c] py-3 text-[15px] font-semibold text-white disabled:opacity-50">{busy === "hold" ? "Sending..." : "Leave for follow-up"}</button>
        </Sheet>
      )}

      {partOpen && visit && <PartPicker companyId={companyId} visitId={visit.id} onClose={() => setPartOpen(false)} onDone={(m) => { setPartOpen(false); flash(m); load(); }} />}

      {toast && <div role="status" className="fixed bottom-44 left-1/2 z-[95] max-w-[90vw] -translate-x-1/2 rounded-xl bg-[#0b1f3a] px-4 py-2.5 text-[14px] font-medium text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out]">{toast}</div>}
    </div>
  );
}

function Big({ children, onClick, busy, tone, icon }: { children: React.ReactNode; onClick: () => void; busy: boolean; tone: "teal" | "violet" | "light"; icon: string }) {
  const cls = tone === "teal" ? "bg-[#0f766e] text-white shadow-[0_8px_20px_rgba(15,118,110,0.3)]" : tone === "violet" ? "bg-[#6d28d9] text-white shadow-[0_8px_20px_rgba(109,40,217,0.25)]" : "border border-slate-200 bg-white text-[#0b1f3a]";
  return (
    <button type="button" onClick={onClick} disabled={busy} className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[16px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-60 ${cls}`}>
      {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Icon d={icon} />}{children}
    </button>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-[bp-sheet_0.22s_ease-out] sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[18px] font-semibold text-[#0b1f3a]">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Usar una pieza: se escanea o se busca en MI van; se descuenta y queda amarrada a este trabajo y su dirección
function PartPicker({ companyId, visitId, onClose, onDone }: { companyId: string; visitId: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [stock, setStock] = useState<Stock[] | null>(null);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Stock | null>(null);
  const [qty, setQty] = useState("1");
  const [scan, setScan] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    createClient().rpc("inv_tech_stock", { p_company: companyId }).then(({ data, error }) => {
      if (error) { setErr("Your van inventory couldn't be loaded."); setStock([]); return; }
      setStock(((data as { stock: Stock[] })?.stock ?? []).map((s) => ({ ...s, qty: Number(s.qty) })).filter((s) => s.qty > 0));
    });
  }, [companyId]);
  const list = (stock ?? []).filter((s) => !q.trim() || `${s.name} ${s.sku ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  function onCode(code: string) {
    setScan(false);
    const hit = (stock ?? []).find((s) => (s.sku ?? "").trim().toLowerCase() === code.trim().toLowerCase());
    if (hit) { setPick(hit); setErr(""); } else { setQ(code); setErr("That barcode isn't in your van. Search by name or ask the office."); }
  }
  async function use() {
    if (!pick) return;
    const n = Number(qty);
    if (!n || n <= 0) return setErr("Enter how many you used.");
    if (n > pick.qty) return setErr(`You only have ${pick.qty} in your van.`);
    setBusy(true);
    const { error } = await createClient().rpc("tech_use_part", { p_visit: visitId, p_item: pick.item_id, p_qty: n, p_note: null, p_from: pick.location_id });
    setBusy(false);
    if (error) return setErr(error.hint || jobError(error));
    onDone(`Used ${n} × ${pick.name}`);
  }
  return (
    <Sheet title={pick ? "How many did you use?" : "Use a part from your van"} onClose={onClose}>
      {pick ? (
        <>
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            {pick.image_url ? <img src={pick.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="h-12 w-12 rounded-lg bg-[#fff7e6]" />}
            <span className="min-w-0"><span className="block truncate text-[15px] font-semibold text-[#0b1f3a]">{pick.name}</span><span className="text-[12.5px] text-slate-500">{pick.qty} in your van{pick.sku ? ` · ${pick.sku}` : ""}</span></span>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4">
            <button type="button" onClick={() => setQty(String(Math.max(1, Number(qty) - 1)))} className="h-12 w-12 rounded-full border border-slate-200 text-[22px] text-slate-600">−</button>
            <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} className="w-24 rounded-xl border border-slate-200 py-2 text-center text-[24px] font-semibold text-[#0b1f3a] focus:border-[#0f766e] focus:outline-none" />
            <button type="button" onClick={() => setQty(String(Number(qty) + 1))} className="h-12 w-12 rounded-full border border-slate-200 text-[22px] text-slate-600">+</button>
          </div>
          {err && <p className="mt-3 text-[13.5px] text-red-600">{err}</p>}
          <button type="button" onClick={use} disabled={busy} className="mt-4 w-full rounded-xl bg-[#0f766e] py-3 text-[15px] font-semibold text-white disabled:opacity-60">{busy ? "Saving..." : "Use on this job"}</button>
          <button type="button" onClick={() => setPick(null)} className="mt-2 w-full py-2 text-[14px] font-medium text-slate-500">Choose another part</button>
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your van" className={inputClass} />
            <button type="button" onClick={() => setScan(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 text-[14px] font-semibold text-white">
              <Icon d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 8v8M11 8v8M14 8v8M17 8v8" className="h-4 w-4" />Scan
            </button>
          </div>
          {err && <p className="mt-2 text-[13.5px] text-red-600">{err}</p>}
          <div className="mt-3 max-h-[50dvh] divide-y divide-slate-100 overflow-y-auto">
            {stock === null && <p className="py-6 text-center text-[14px] text-slate-400">Loading your van…</p>}
            {stock && list.length === 0 && <p className="py-6 text-center text-[14px] text-slate-500">{stock.length ? "No parts match." : "Your van is empty or you don't have a van assigned."}</p>}
            {list.map((sItem) => (
              <button key={`${sItem.item_id}-${sItem.location_id}`} type="button" onClick={() => { setPick(sItem); setQty("1"); setErr(""); }} className="flex w-full items-center gap-3 py-2.5 text-left active:bg-slate-50">
                {sItem.image_url ? <img src={sItem.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="h-10 w-10 rounded-lg bg-[#fff7e6]" />}
                <span className="min-w-0 flex-1"><span className="block truncate text-[15px] text-[#0b1f3a]">{sItem.name}</span><span className="text-[12px] text-slate-500">{sItem.sku ?? "No SKU"}</span></span>
                <span className="text-[13px] font-semibold text-slate-600">{sItem.qty}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <BarcodeScanner open={scan} everywhere onClose={() => setScan(false)} onCode={onCode} />
    </Sheet>
  );
}
