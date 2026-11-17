"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { askConfirm } from "@/lib/confirm";
import { jobError } from "@/lib/jobs";
import { JobPhase, PHASE_META, PhaseStatus, phasePct, phaseShare } from "@/lib/phases";

// =====================================================================
// Fases del trabajo (Paso 5.4) — la misma pieza para el teléfono del colaborador y la ficha de oficina.
//  · Tocar el círculo: Pendiente → En proceso → Terminada.
//  · "Block" pide el motivo (le llega aviso al dueño).
//  · Oficina (canEdit): cambia nombres, pesos y orden solo para este trabajo.
// =====================================================================
type Draft = { id: string | null; name: string; weight: string; key: string };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
let seq = 0;
const newKey = () => `n${++seq}`;

export default function JobPhases({ jobId, canEdit = false, readOnly = false, variant = "office", onProgress, onToast }: {
  jobId: string; canEdit?: boolean; readOnly?: boolean; variant?: "tech" | "office";
  onProgress?: (pct: number | null) => void; onToast?: (m: string, err?: boolean) => void;
}) {
  const [list, setList] = useState<JobPhase[] | null>(null); // null = cargando o el SQL no está
  const [busy, setBusy] = useState("");
  const [blockId, setBlockId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const [error, setError] = useState("");
  const cb = useRef(onProgress); cb.current = onProgress;
  const tech = variant === "tech";

  const load = useCallback(async () => {
    const { data, error: e } = await createClient().from("job_phases")
      .select("id, job_id, position, name, weight, status, blocked_reason, started_at, completed_at, updated_at, updated_by_name")
      .eq("job_id", jobId).order("position");
    if (e) { setList(null); return; }
    setList((data ?? []) as JobPhase[]);
  }, [jobId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const sb = createClient();
    let t: ReturnType<typeof setTimeout>;
    const ch = sb.channel(`job-phases-${jobId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_phases", filter: `job_id=eq.${jobId}` }, () => { clearTimeout(t); t = setTimeout(load, 400); })
      .subscribe();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(t); sb.removeChannel(ch); document.removeEventListener("visibilitychange", onVis); };
  }, [jobId, load]);

  const pct = useMemo(() => (list && list.length ? phasePct(list) : null), [list]);
  useEffect(() => { cb.current?.(pct); }, [pct]);

  const fail = (m: string) => { setError(m); onToast?.(m, true); setTimeout(() => setError((x) => (x === m ? "" : x)), 5000); };

  async function setStatus(p: JobPhase, status: PhaseStatus, why?: string) {
    if (readOnly || busy) return;
    const before = list;
    setBusy(p.id);
    setList((l) => l && l.map((x) => (x.id === p.id ? { ...x, status, blocked_reason: status === "blocked" ? why ?? null : null } : x)));
    const { error: e } = await createClient().rpc("job_phase_set", { p_phase: p.id, p_status: status, p_reason: why ?? null });
    setBusy("");
    if (e) { setList(before); fail(jobError(e)); return; }
    load();
  }
  async function tap(p: JobPhase) {
    if (readOnly) return;
    if (p.status === "pending") return setStatus(p, "in_progress");
    if (p.status === "in_progress") return setStatus(p, "completed");
    if (p.status === "blocked") return setStatus(p, "in_progress");
    if (!(await askConfirm({ title: `Reopen "${p.name}"?`, message: "It goes back to pending and the progress goes down.", confirmLabel: "Reopen phase" }))) return;
    setStatus(p, "pending");
  }
  async function block(p: JobPhase) {
    const why = reason.trim();
    if (!why) return fail("Write why this phase is blocked.");
    setBlockId(null); setReason("");
    await setStatus(p, "blocked", why);
  }

  // ---------- Oficina: editar las fases de este trabajo ----------
  const startEdit = () => setDraft((list ?? []).map((p) => ({ id: p.id, name: p.name, weight: String(Number(p.weight)), key: p.id })));
  const move = (i: number, d: number) => setDraft((l) => { if (!l) return l; const n = [...l]; const k = i + d; if (k < 0 || k >= n.length) return l; [n[i], n[k]] = [n[k], n[i]]; return n; });
  async function saveDraft() {
    if (!draft) return;
    const rows = draft.map((r) => ({ id: r.id, name: r.name.trim(), weight: Math.max(Number(r.weight) || 0, 0) })).filter((r) => r.name);
    setBusy("save");
    const { error: e } = await createClient().rpc("job_phases_save", { p_job: jobId, p_phases: rows });
    setBusy("");
    if (e) return fail(jobError(e));
    setDraft(null); onToast?.("Phases saved"); load();
  }
  async function applyType() {
    setBusy("apply");
    const { error: e } = await createClient().rpc("job_phases_apply", { p_job: jobId });
    setBusy("");
    if (e) return fail(jobError(e));
    onToast?.("Phases added"); load();
  }

  if (list === null) return null; // sin el SQL del Paso 5.4 no se muestra nada
  if (list.length === 0 && !canEdit) return null;

  const done = list.filter((p) => p.status === "completed").length;
  const box = tech ? "mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3" : "rounded-2xl border border-slate-200 bg-white p-5";
  const title = tech ? "text-[15px] font-semibold text-[#0b1f3a]" : "text-[16px] font-semibold text-[#0b1f3a]";
  const draftTotal = draft ? draft.reduce((a, r) => a + (Number(r.weight) || 0), 0) : 0;

  return (
    <section className={box}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={title}>Phases {list.length > 0 && <span className="font-normal text-slate-400">{done}/{list.length}</span>}</h2>
        <div className="flex items-center gap-3">
          {pct != null && <span className="text-[14px] font-semibold tabular-nums text-[#e8713a]">{pct}%</span>}
          {canEdit && !draft && list.length > 0 && !readOnly && (
            <button type="button" onClick={startEdit} className="rounded-lg px-2.5 py-1 text-[13px] font-semibold text-[#0f766e] transition-colors hover:bg-[#e9f7f4]">Edit</button>
          )}
        </div>
      </div>

      {pct != null && !draft && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[#e8713a] transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
      )}
      {error && <p className="mt-2 rounded-lg bg-[#fff1f2] px-3 py-2 text-[13px] font-medium text-[#be123c]">{error}</p>}

      {/* Sin fases (solo oficina) */}
      {list.length === 0 && !draft && (
        <div className="mt-2">
          <p className="text-[14px] text-slate-500">This job has no phases yet. Add them so the progress follows the real work.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={applyType} disabled={busy === "apply"} className="rounded-lg bg-[#0f766e] px-3.5 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">{busy === "apply" ? "Adding…" : "Use the job type's phases"}</button>
            <button type="button" onClick={() => setDraft([{ id: null, name: "", weight: "1", key: newKey() }])} className="rounded-lg border border-slate-200 px-3.5 py-2 text-[13.5px] font-semibold text-[#0b1f3a] transition-colors hover:bg-slate-50">Write my own</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {!draft && list.length > 0 && (
        <ul className={tech ? "mt-2 space-y-1" : "mt-3 divide-y divide-slate-100"}>
          {list.map((p) => {
            const m = PHASE_META[p.status];
            const share = phaseShare(p.weight, list);
            return (
              <li key={p.id} className={tech ? "rounded-xl px-1 py-2" : "py-3"}>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => tap(p)} disabled={readOnly || busy === p.id} aria-label={`${p.name}: ${m.label}. Tap to change`}
                    className={`flex ${tech ? "h-9 w-9" : "h-7 w-7"} shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 active:scale-90 disabled:cursor-default ${m.ring} ${p.status === "completed" ? "bg-[#14a39a] text-white" : p.status === "blocked" ? "bg-[#fff1f2] text-[#e11d48]" : p.status === "in_progress" ? "bg-[#fff6e6]" : "bg-white"}`}>
                    {p.status === "completed" && <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 10.5 3 3 7-7" /></svg>}
                    {p.status === "in_progress" && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#f59e0b]" />}
                    {p.status === "blocked" && <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l8 8M14 6l-8 8" /></svg>}
                  </button>
                  <button type="button" onClick={() => tap(p)} disabled={readOnly || busy === p.id} className="min-w-0 flex-1 text-left disabled:cursor-default">
                    <span className={`block truncate ${tech ? "text-[15px]" : "text-[14.5px]"} font-medium ${p.status === "completed" ? "text-slate-500" : "text-[#0b1f3a]"}`}>{p.name}</span>
                    <span className="block text-[12px] text-slate-400">
                      <span className={`font-semibold ${m.text}`}>{m.label}</span> · {share}% of the job
                      {p.status === "completed" && p.updated_by_name ? ` · ${p.updated_by_name}, ${when(p.completed_at)}` : ""}
                      {p.status === "in_progress" && p.updated_by_name ? ` · ${p.updated_by_name}` : ""}
                    </span>
                  </button>
                  {!readOnly && p.status !== "completed" && p.status !== "blocked" && blockId !== p.id && (
                    <button type="button" onClick={() => { setBlockId(p.id); setReason(""); }} className="shrink-0 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-slate-400 transition-colors hover:bg-[#fff1f2] hover:text-[#be123c]">Block</button>
                  )}
                </div>
                {p.status === "blocked" && p.blocked_reason && (
                  <p className={`${tech ? "ml-12" : "ml-10"} mt-1.5 rounded-lg bg-[#fff1f2] px-3 py-2 text-[13px] text-[#9f1239]`}>
                    <span className="font-semibold">Blocked{p.updated_by_name ? ` by ${p.updated_by_name}` : ""}:</span> {p.blocked_reason}
                    {!readOnly && <span className="mt-0.5 block text-[12px] text-[#be123c]/80">Tap the phase to continue it.</span>}
                  </p>
                )}
                {blockId === p.id && (
                  <div className={`${tech ? "ml-12" : "ml-10"} mt-2`}>
                    <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} placeholder="Why is it blocked? e.g. waiting on the part, customer not home"
                      className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-[#0b1f3a] outline-none transition-colors focus:border-[#14a39a]" />
                    <div className="mt-1.5 flex justify-end gap-2">
                      <button type="button" onClick={() => setBlockId(null)} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-500 hover:bg-slate-100">Cancel</button>
                      <button type="button" onClick={() => block(p)} className="rounded-lg bg-[#e11d48] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#be123c]">Mark as blocked</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Editor (oficina) */}
      {draft && (
        <div className="mt-3">
          <p className="text-[13px] text-slate-500">The weight is how much of the job each phase is worth. They don't have to add up to 100 — the % is worked out for you.</p>
          <div className="mt-3 space-y-2">
            {draft.map((r, i) => (
              <div key={r.key} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="rounded px-1 text-slate-400 hover:text-[#0f766e] disabled:opacity-30"><svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5-5 5 5" /></svg></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === draft.length - 1} aria-label="Move down" className="rounded px-1 text-slate-400 hover:text-[#0f766e] disabled:opacity-30"><svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 5 5 5-5" /></svg></button>
                </div>
                <input value={r.name} onChange={(e) => setDraft((l) => l && l.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)))} maxLength={80} placeholder="Phase name" aria-label="Phase name"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-[#0b1f3a] outline-none focus:border-[#14a39a]" />
                <input value={r.weight} onChange={(e) => setDraft((l) => l && l.map((x) => (x.key === r.key ? { ...x, weight: e.target.value.replace(/[^\d.]/g, "") } : x)))} inputMode="decimal" aria-label="Weight"
                  className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-center text-[14px] tabular-nums text-[#0b1f3a] outline-none focus:border-[#14a39a]" />
                <span className="w-10 text-right text-[12.5px] tabular-nums text-slate-400">{draftTotal ? Math.round((100 * (Number(r.weight) || 0)) / draftTotal) : 0}%</span>
                <button type="button" onClick={() => setDraft((l) => l && l.filter((x) => x.key !== r.key))} aria-label="Remove phase" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[#fff1f2] hover:text-[#e11d48]"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setDraft((l) => [...(l ?? []), { id: null, name: "", weight: "1", key: newKey() }])} className="mt-2 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[#0f766e] hover:bg-[#e9f7f4]">+ Add phase</button>
          <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => setDraft(null)} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-slate-500 hover:bg-slate-100">Cancel</button>
            <button type="button" onClick={saveDraft} disabled={busy === "save"} className="rounded-lg bg-[#0f766e] px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">{busy === "save" ? "Saving…" : "Save phases"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
