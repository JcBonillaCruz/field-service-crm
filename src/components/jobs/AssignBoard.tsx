"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DatePicker from "@/components/ui/DatePicker";
import { SiteAddress, addDays, addressLine, dayStart, fmtDayShort, fmtTime, fromIsoDay, isoDay, jobError, startOfWeek } from "@/lib/jobs";
import { TechDot } from "@/components/jobs/EventBar";

export type AssignTech = { user_id: string; full_name: string; initials: string; color: string; avatar_url: string | null; email: string | null; phone: string | null; job_title: string | null };
type Row = {
  id: string; job_id: string; status: string; starts_at: string | null; ends_at: string | null; tech_ids: string[];
  number: string; customer_name: string; customer_phone: string | null; title: string | null; priority: string; site_address: SiteAddress;
  type_name: string | null; type_color: string | null;
};
type Range = "today" | "tomorrow" | "week" | "date";
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// =====================================================================
// Asignar trabajos: a la izquierda los trabajos, a la derecha los técnicos.
// Arrastra un trabajo y suéltalo en un técnico (en el celular: toca el trabajo y luego el técnico).
// =====================================================================
export default function AssignBoard({ companyId, techs, weekStartsOn }: { companyId: string; techs: AssignTech[]; weekStartsOn: number }) {
  const [range, setRange] = useState<Range>("today");
  const [date, setDate] = useState(isoDay(new Date()));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tq, setTq] = useState("");
  const [picked, setPicked] = useState<string | null>(null);   // tocar para asignar (celular)
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [pulse, setPulse] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const reqId = useRef(0);

  const [from, to] = useMemo(() => {
    const today = dayStart(new Date());
    if (range === "today") return [today, addDays(today, 1)];
    if (range === "tomorrow") return [addDays(today, 1), addDays(today, 2)];
    if (range === "week") { const s = startOfWeek(today, weekStartsOn); return [s, addDays(s, 7)]; }
    const d = fromIsoDay(date); return [d, addDays(d, 1)];
  }, [range, date, weekStartsOn]);

  const flash = (msg: string, error = false) => { setToast({ msg, error }); setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), error ? 5000 : 2500); };

  const load = useCallback(async () => {
    const id = ++reqId.current;
    const sb = createClient();
    const sel = "id, job_id, status, starts_at, ends_at, job_visit_techs ( user_id ), jobs!inner ( number, customer_name, customer_phone, title, priority, site_address, cancelled_at, job_types ( name, color ) )";
    const [a, b] = await Promise.all([
      sb.from("job_visits").select(sel).eq("company_id", companyId).eq("status", "unscheduled").limit(500),
      sb.from("job_visits").select(sel).eq("company_id", companyId).in("status", ["scheduled", "on_my_way", "in_progress", "paused"])
        .gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString()).order("starts_at").limit(2000),
    ]);
    if (id !== reqId.current) return;
    if (a.error || b.error) { flash(jobError(a.error ?? b.error), true); setLoading(false); return; }
    type Raw = { id: string; job_id: string; status: string; starts_at: string | null; ends_at: string | null; job_visit_techs: { user_id: string }[];
      jobs: { number: string; customer_name: string; customer_phone: string | null; title: string | null; priority: string; site_address: SiteAddress; cancelled_at: string | null; job_types: { name: string; color: string } | null } };
    const map = (r: Raw): Row => ({
      id: r.id, job_id: r.job_id, status: r.status, starts_at: r.starts_at, ends_at: r.ends_at, tech_ids: r.job_visit_techs.map((t) => t.user_id),
      number: r.jobs.number, customer_name: r.jobs.customer_name, customer_phone: r.jobs.customer_phone, title: r.jobs.title, priority: r.jobs.priority,
      site_address: r.jobs.site_address, type_name: r.jobs.job_types?.name ?? null, type_color: r.jobs.job_types?.color ?? null,
    });
    setRows([...((b.data ?? []) as unknown as Raw[]), ...((a.data ?? []) as unknown as Raw[])].filter((r) => !r.jobs.cancelled_at).map(map));
    setLoading(false);
  }, [companyId, from, to]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    const sb = createClient();
    let t: ReturnType<typeof setTimeout>;
    const again = () => { clearTimeout(t); t = setTimeout(load, 500); };
    const ch = sb.channel(`assign-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visit_techs", filter: `company_id=eq.${companyId}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visits", filter: `company_id=eq.${companyId}` }, again)
      .subscribe();
    return () => { clearTimeout(t); sb.removeChannel(ch); };
  }, [companyId, load]);

  // Asignar (reemplaza al técnico que tenía) · se avisa al técnico al momento
  async function assign(rowId: string, techId: string | null) {
    const row = rows.find((r) => r.id === rowId); if (!row) return;
    const before = row.tech_ids;
    const next = techId ? [techId] : [];
    if (before.length === next.length && before.every((t) => next.includes(t))) return;
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, tech_ids: next } : r)));
    setPicked(null);
    const { error } = await createClient().rpc("visit_set_techs", { p_visit: rowId, p_techs: next, p_lead: techId });
    if (error) { setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, tech_ids: before } : r))); flash(error.hint || jobError(error), true); return; }
    if (techId) { setPulse(techId); setTimeout(() => setPulse((p) => (p === techId ? null : p)), 700); }
    const name = techId ? techs.find((t) => t.user_id === techId)?.full_name ?? "technician" : null;
    flash(name ? `${row.customer_name || row.number} → ${name}` : `${row.customer_name || row.number} is unassigned`);
    fetch("/api/jobs/notify", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitId: rowId, assigned: next.filter((t) => !before.includes(t)), unassigned: before.filter((t) => !next.includes(t)) }) }).catch(() => null);
  }

  // Orden de los técnicos (se arrastran para acomodarlos; se guarda en este navegador)
  const ORDER_KEY = `bp-assign-order-${companyId}`;
  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => { try { setOrder(JSON.parse(localStorage.getItem(ORDER_KEY) || "[]")); } catch { /* */ } }, [ORDER_KEY]);
  function moveTech(id: string, beforeId: string) {
    if (id === beforeId) return;
    const base = sortedTechs.map((t) => t.user_id).filter((x) => x !== id);
    const i = base.indexOf(beforeId);
    base.splice(i < 0 ? base.length : i, 0, id);
    setOrder(base);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(base)); } catch { /* */ }
  }

  // A la izquierda SOLO los que no tienen técnico: al asignarlo desaparece (así no se asigna dos veces)
  const shownJobs = useMemo(() => {
    const term = fold(q.trim());
    return rows.filter((r) => r.tech_ids.length === 0
      && (!term || fold(`${r.number} ${r.customer_name} ${r.customer_phone ?? ""} ${r.title ?? ""} ${addressLine(r.site_address)}`).includes(term)));
  }, [rows, q]);
  const hours = (id: string) => rows.filter((r) => r.tech_ids.includes(id) && r.starts_at && r.ends_at)
    .reduce((a, r) => a + (new Date(r.ends_at!).getTime() - new Date(r.starts_at!).getTime()) / 3600000, 0);
  const sortedTechs = useMemo(() => {
    const pos = new Map(order.map((id, i) => [id, i]));
    return [...techs].sort((x, y) => (pos.get(x.user_id) ?? 9999) - (pos.get(y.user_id) ?? 9999) || x.full_name.localeCompare(y.full_name));
  }, [techs, order]);
  const shownTechs = useMemo(() => {
    const term = fold(tq.trim()), digits = tq.replace(/\D/g, "");
    return sortedTechs.filter((t) => !term || fold(`${t.full_name} ${t.email ?? ""} ${t.job_title ?? ""}`).includes(term) || (digits.length >= 3 && (t.phone ?? "").replace(/\D/g, "").includes(digits)));
  }, [sortedTechs, tq]);
  const pickedRow = rows.find((r) => r.id === picked);

  // Arrastrar: "job:<visita>" (trabajo) o "tech:<técnico>" (acomodar técnicos)
  const onDropTech = (e: React.DragEvent, techId: string) => {
    e.preventDefault(); setOver(null); setDragId(null);
    const data = e.dataTransfer.getData("text/plain");
    if (data.startsWith("tech:")) moveTech(data.slice(5), techId);
    else if (data.startsWith("job:")) assign(data.slice(4), techId);
  };
  const jobDrag = (id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.stopPropagation(); e.dataTransfer.setData("text/plain", `job:${id}`); e.dataTransfer.effectAllowed = "move"; setDragId(id); },
    onDragEnd: () => { setDragId(null); setOver(null); },
  });

  const rangeBtn = (k: Range, label: string) => (
    <button type="button" onClick={() => setRange(k)}
      className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all ${range === k ? "bg-white text-[#0f766e] shadow-sm" : "text-slate-500 hover:text-[#0b1f3a]"}`}>{label}</button>
  );
  const search = (value: string, set: (v: string) => void, ph: string) => (
    <div className="relative min-w-0 flex-1">
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
      <input value={value} onChange={(e) => set(e.target.value)} placeholder={ph}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[14px] focus:border-[#0f766e] focus:bg-white focus:outline-none" />
    </div>
  );

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-[#f4f6f8] lg:h-[calc(100dvh-4rem)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
        <div className="mr-auto">
          <h1 className="text-[20px] font-semibold tracking-tight text-[#0b1f3a]">Assign jobs</h1>
          <p className="text-[13px] text-slate-500">Drag a job onto a technician. On the phone: tap the job, then tap the technician.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5">{rangeBtn("today", "Today")}{rangeBtn("tomorrow", "Tomorrow")}{rangeBtn("week", "This week")}</div>
          <div className="w-44" onClick={() => setRange("date")}><DatePicker value={range === "date" ? date : ""} placeholder="Pick a day" onChange={(v) => { setDate(v); setRange("date"); }} /></div>
        </div>
      </div>

      {/* Mitad y mitad: trabajos sin técnico | técnicos */}
      <div className="grid min-h-0 flex-1 gap-4 p-3 lg:grid-cols-2 lg:p-5">
        <section
          onDragOver={(e) => { if (dragId && rows.find((r) => r.id === dragId)?.tech_ids.length) { e.preventDefault(); setOver("__left"); } }}
          onDragLeave={() => setOver((o) => (o === "__left" ? null : o))}
          onDrop={(e) => { e.preventDefault(); setOver(null); setDragId(null); const d = e.dataTransfer.getData("text/plain"); if (d.startsWith("job:")) assign(d.slice(4), null); }}
          className={`flex min-h-0 flex-col rounded-2xl border bg-white transition-colors ${over === "__left" ? "border-[#f59e0b] bg-[#fffaf0]" : "border-slate-200"}`}>
          <div className="flex items-center gap-2 border-b border-slate-100 p-3">
            <p className="shrink-0 text-[14px] font-semibold text-[#0b1f3a]">To assign <span className={`ml-1 rounded-full px-2 py-0.5 text-[12px] ${shownJobs.length ? "bg-[#fff4e0] text-[#b45309]" : "bg-slate-100 text-slate-400"}`}>{rows.filter((r) => !r.tech_ids.length).length}</span></p>
            {search(q, setQ, "Search: customer, phone, address, #")}
          </div>
          <div className="min-h-[12rem] flex-1 overflow-y-auto p-3">
            {over === "__left" && <p className="mb-2 rounded-lg border-2 border-dashed border-[#f59e0b] py-2 text-center text-[13px] font-semibold text-[#b45309]">Drop here to unassign</p>}
            {loading ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[4.6rem] animate-pulse rounded-xl bg-slate-100" />)}</div>
            ) : shownJobs.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e7f6f1] text-[#0f766e]"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 9.5 17 19 7" /></svg></span>
                <p className="mt-3 text-[15px] font-semibold text-[#0b1f3a]">{q ? "No jobs match" : "Every job has a technician"}</p>
                <p className="mt-1 text-[13px] text-slate-500">To move a job to someone else, drag it from one technician to another.</p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
                {shownJobs.map((r) => {
                  const s = r.starts_at ? new Date(r.starts_at) : null;
                  const sel = picked === r.id;
                  return (
                    <div key={r.id} {...jobDrag(r.id)} onClick={() => setPicked(sel ? null : r.id)}
                      className={`group cursor-grab select-none rounded-xl border bg-white px-3 py-2 transition-all duration-100 active:cursor-grabbing ${sel ? "border-[#0f766e] ring-4 ring-[#14a39a]/15" : "border-slate-200 hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-[0_8px_18px_rgba(15,40,60,0.09)]"} ${dragId === r.id ? "opacity-40" : ""}`}
                      style={{ borderTop: `3px solid ${r.type_color ?? "#94a3b8"}` }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold text-slate-500">{s ? `${fmtDayShort(s).replace(/^\w+, /, "")} · ${fmtTime(s)}` : "No date"}</span>
                        {(r.priority === "urgent" || r.priority === "high") && <span className={`rounded-full px-1.5 text-[10px] font-bold uppercase ${r.priority === "urgent" ? "bg-[#ffe4e6] text-[#be123c]" : "bg-[#fff4e0] text-[#b45309]"}`}>{r.priority}</span>}
                      </div>
                      <p className="mt-0.5 truncate text-[14px] font-semibold text-[#0b1f3a]">{r.customer_name || r.number}</p>
                      <p className="truncate text-[12px] text-slate-500">{[r.type_name ?? r.title, addressLine(r.site_address).split(",")[0]].filter(Boolean).join(" · ") || `#${r.number}`}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 p-3">
            <p className="shrink-0 text-[14px] font-semibold text-[#0b1f3a]">Technicians <span className="font-normal text-slate-400">({techs.length})</span></p>
            {search(tq, setTq, "Search by name, phone or email")}
          </div>
          <div className="min-h-[12rem] flex-1 overflow-y-auto p-3">
            {techs.length === 0 && <p className="px-3 py-10 text-center text-[13.5px] text-slate-500">No technicians yet. Invite them in Team with the Technician role.</p>}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] items-start gap-2.5">
              {shownTechs.map((t) => {
                const mine = rows.filter((r) => r.tech_ids.includes(t.user_id)).sort((x, y) => (x.starts_at ?? "z").localeCompare(y.starts_at ?? "z"));
                const n = mine.length, h = hours(t.user_id), isOver = over === t.user_id;
                return (
                  <div key={t.user_id}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== t.user_id) setOver(t.user_id); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === t.user_id ? null : o)); }}
                    onDrop={(e) => onDropTech(e, t.user_id)}
                    className={`rounded-xl border transition-all duration-150 ${isOver ? "scale-[1.02] border-[#0f766e] bg-[#f3fbf8] shadow-[0_12px_26px_rgba(15,118,110,0.18)]" : picked ? "border-dashed border-[#14a39a] bg-white" : "border-slate-200 bg-white hover:shadow-[0_6px_16px_rgba(15,40,60,0.06)]"}`}
                    style={{ borderTop: `3px solid ${t.color}` }}>
                    <div draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", `tech:${t.user_id}`); e.dataTransfer.effectAllowed = "move"; }}
                      onClick={() => picked && assign(picked, t.user_id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 ${picked ? "cursor-pointer" : "cursor-grab"}`} title="Drag to reorder technicians">
                      <TechDot t={t} size={34} ring={false} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-[#0b1f3a]">{t.full_name}</span>
                        <span className="block truncate text-[11.5px] text-slate-500">{[t.job_title, t.phone].filter(Boolean).join(" · ") || t.email}</span>
                      </span>
                      <span className="text-right">
                        <span className={`inline-flex min-w-[1.9rem] items-center justify-center rounded-full px-2 py-0.5 text-[13px] font-bold ${n ? "bg-[#0f766e] text-white" : "bg-slate-100 text-slate-400"} ${pulse === t.user_id ? "animate-[bp-pop-in_0.5s_ease-out]" : ""}`}>{n}</span>
                        {h > 0 && <span className="block text-[10.5px] text-slate-400">{h.toFixed(1)}h</span>}
                      </span>
                    </div>
                    {picked && pickedRow && <button type="button" onClick={() => assign(picked, t.user_id)} className="w-full border-t border-dashed border-[#bfe7de] px-3 py-1.5 text-left text-[12px] font-semibold text-[#0f766e]">Tap to assign {pickedRow.customer_name || pickedRow.number}</button>}
                    <div className="space-y-1 border-t border-slate-100 px-2 py-2">
                      {mine.length === 0 && <p className="px-1 py-1.5 text-center text-[12px] text-slate-400">{isOver ? "Drop to assign" : "No jobs · drop one here"}</p>}
                      {mine.map((r) => (
                        <div key={r.id} {...jobDrag(r.id)} title="Drag to another technician"
                          className={`flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors active:cursor-grabbing hover:bg-slate-50 ${dragId === r.id ? "opacity-40" : ""}`}
                          style={{ background: `${r.type_color ?? "#94a3b8"}12` }}>
                          <span className="w-14 shrink-0 font-semibold text-slate-500">{r.starts_at ? fmtTime(new Date(r.starts_at)) : "No date"}</span>
                          <span className="min-w-0 flex-1 truncate text-[#0b1f3a]">{r.customer_name || r.number}</span>
                          <button type="button" onClick={() => assign(r.id, null)} title="Unassign" aria-label="Unassign"
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
                            <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {picked && pickedRow && (
        <div className="fixed inset-x-3 bottom-4 z-40 flex items-center gap-3 rounded-2xl bg-[#0b1f3a] px-4 py-3 text-white shadow-2xl lg:hidden">
          <p className="min-w-0 flex-1 truncate text-[14px]">Now tap a technician for <b>{pickedRow.customer_name || pickedRow.number}</b></p>
          <button type="button" onClick={() => setPicked(null)} className="text-[13px] font-semibold text-white/70">Cancel</button>
        </div>
      )}
      {toast && <div role="status" className={`fixed bottom-5 left-1/2 z-[95] max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out] ${toast.error ? "bg-[#be123c]" : "bg-[#0b1f3a]"}`}>{toast.msg}</div>}
    </div>
  );
}
