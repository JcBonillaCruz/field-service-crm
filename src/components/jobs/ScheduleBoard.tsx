"use client";

import { askConfirm } from "@/lib/confirm";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import {
  CalView, CalVisit, ColorBy, JobRow, JobSettings, JobStatus, JobType, PRIORITIES, STATUS_META, STATUS_ORDER, TeamMember, TechChip, UNASSIGNED_COLOR, leadOf, startOfMonth, startOfWeek,
  addDays, addMinutes, atMinute, barColor, dayStart, fmtDayShort, fmtTime, fromIsoDay, isoDay, jobError, minutesOf,
  afterHoursOf, rangeLabel, receivesJobs, sameDay, shiftAnchor, timeToMin, viewDays,
} from "@/lib/jobs";
import { Col, GridApi, Handlers, Hit, Preview } from "@/components/jobs/cal-shared";
import TimeGrid from "@/components/jobs/TimeGrid";
import DispatchGrid from "@/components/jobs/DispatchGrid";
import MonthGrid from "@/components/jobs/MonthGrid";
import VisitPopover, { OfficeAction } from "@/components/jobs/VisitPopover";
import JobTray from "@/components/jobs/JobTray";
import { TechDot } from "@/components/jobs/EventBar";
import { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";

const VIEWS: { id: CalView; label: string }[] = [
  { id: "day", label: "Day" }, { id: "week", label: "Week" }, { id: "workweek", label: "Mon–Fri" }, { id: "month", label: "Month" }, { id: "dispatch", label: "Dispatch" },
];
const COLOR_KEY = "bp-schedule-color";
const TRAY_KEY = "bp-schedule-tray";
const UNASSIGNED = "__none__";

// Estado de la visita llevado a las pestañas del trabajo
const asJobStatus = (v: CalVisit): JobStatus =>
  v.job_status === "cancelled" ? "cancelled" : v.visit_status === "paused" ? "in_progress" : v.visit_status === "unscheduled" ? "unscheduled" : (v.visit_status as JobStatus);

type DragState = {
  kind: "move" | "resize" | "create" | "tray"; pointerId: number; touch: boolean;
  x0: number; y0: number; lastX: number; lastY: number; active: boolean; scrolled: boolean; timer?: ReturnType<typeof setTimeout>;
  el?: HTMLElement; visit?: CalVisit; job?: JobRow; col?: Col; offsetMin: number; durMin: number; startMin: number;
  color: string; label: string; hit?: Hit | null; preview?: Preview; overTray?: boolean; locked?: boolean;
};

export default function ScheduleBoard({ companyId, settings, types, team, canSeeMoney }: {
  companyId: string; settings: JobSettings; types: JobType[]; team: TeamMember[]; canSeeMoney: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  // Siempre abre en Semana (a menos que el enlace diga otra vista)
  const [view, setView] = useState<CalView>(() => (VIEWS.some((v) => v.id === sp.get("view")) ? (sp.get("view") as CalView) : "week"));
  const [colorBy, setColorBy] = useState<ColorBy>("tech");
  const [draft, setDraft] = useState<{ day: Date; startMin: number; endMin: number; techId: string | null; x: number; y: number } | null>(null);
  const [ask, setAsk] = useState<{ v: CalVisit; start: Date } | null>(null);
  const [anchor, setAnchor] = useState<Date>(() => (sp.get("date") ? fromIsoDay(sp.get("date") as string) : dayStart(new Date())));
  const [visits, setVisits] = useState<CalVisit[]>([]);
  const [tray, setTray] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [trayOpen, setTrayOpen] = useState(false);
  const [statusF, setStatusF] = useState<"all" | JobStatus>("all");
  const [techF, setTechF] = useState<string[]>([]);
  const [typeF, setTypeF] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "error" } | null>(null);
  const [preview, setPreview] = useState<Preview>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [trayDrop, setTrayDrop] = useState(false);
  const [pop, setPop] = useState<{ v: CalVisit; rect: DOMRect; pinned: boolean } | null>(null);
  const apiRef = useRef<GridApi | null>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const hoverT = useRef<ReturnType<typeof setTimeout>>();
  const hideT = useRef<ReturnType<typeof setTimeout>>();
  const reqId = useRef(0);
  const pendingReload = useRef(false);

  const slot = settings.slot_minutes || 30;
  const workStart = timeToMin(settings.day_start);
  const workEnd = Math.max(workStart + 60, timeToMin(settings.day_end));
  const days = useMemo(() => viewDays(view, anchor, settings.week_starts_on), [view, anchor, settings.week_starts_on]);
  const rangeStart = days[0], rangeEnd = addDays(days[days.length - 1], 1);
  const rangeKey = `${isoDay(rangeStart)}_${isoDay(rangeEnd)}`;
  const typeDur = useMemo(() => new Map(types.map((t) => [t.id, t.default_duration_min])), [types]);

  // Vista guardada y bandeja (celular: Día y bandeja cerrada)
  useEffect(() => {
    const small = window.innerWidth < 1024;
    const c = localStorage.getItem(COLOR_KEY) as ColorBy | null;
    if (c === "tech" || c === "type" || c === "priority") setColorBy(c);
    setTrayOpen(!small && localStorage.getItem(TRAY_KEY) !== "0");
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    window.history.replaceState(null, "", `?view=${view}&date=${isoDay(anchor)}`);
  }, [view, anchor]);

  const flash = useCallback((msg: string, tone: "ok" | "error" = "ok") => {
    setToast({ msg, tone });
    setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), tone === "error" ? 6000 : 3000);
  }, []);

  const load = useCallback(async () => {
    if (drag.current?.active) { pendingReload.current = true; return; }
    const id = ++reqId.current;
    const sb = createClient();
    const [cal, tr] = await Promise.all([
      sb.from("v_job_calendar").select("*").eq("company_id", companyId)
        .lt("starts_at", rangeEnd.toISOString()).gt("ends_at", rangeStart.toISOString()).order("starts_at").limit(3000),
      sb.from("v_jobs").select("id, company_id, number, customer_id, customer_name, customer_phone, address_id, site_address, job_type_id, title, description, priority, status, estimated_total, visit_count, hold_reason, hold_note, hold_at, needs_followup, created_at, type_name, type_color, techs, tech_ids, tags")
        .eq("company_id", companyId).in("status", ["unscheduled", "on_hold"]).order("created_at", { ascending: false }).limit(300),
    ]);
    if (id !== reqId.current) return;
    if (cal.error) flash(jobError(cal.error), "error");
    else setVisits((cal.data ?? []).map((v) => ({ ...v, estimated_total: Number(v.estimated_total) })) as CalVisit[]);
    if (!tr.error) setTray((tr.data ?? []) as unknown as JobRow[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, rangeKey, flash]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Tiempo real: si alguien mueve una barra o el técnico cambia el estado, se actualiza solo
  useEffect(() => {
    const sb = createClient();
    let t: ReturnType<typeof setTimeout>;
    const again = () => { clearTimeout(t); t = setTimeout(() => load(), 450); };
    const ch = sb.channel(`schedule-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visits", filter: `company_id=eq.${companyId}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `company_id=eq.${companyId}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_visit_techs", filter: `company_id=eq.${companyId}` }, again)
      .subscribe();
    const onShow = () => { if (document.visibilityState === "visible") again(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearTimeout(t); sb.removeChannel(ch); document.removeEventListener("visibilitychange", onShow); };
  }, [companyId, load]);

  // ---------- Filtros ----------
  const counts = useMemo(() => {
    const c = new Map<string, number>([["all", visits.length]]);
    visits.forEach((v) => { const s = asJobStatus(v); c.set(s, (c.get(s) ?? 0) + 1); });
    return c;
  }, [visits]);
  const colored = useMemo(() => visits.map((v) => ({
    ...v, color: colorBy === "type" ? v.type_color ?? UNASSIGNED_COLOR
      : colorBy === "priority" ? PRIORITIES.find((p) => p.value === v.priority)?.color ?? UNASSIGNED_COLOR
      : leadOf(v.techs)?.color ?? UNASSIGNED_COLOR,
    after_hours: afterHoursOf(new Date(v.starts_at), new Date(v.ends_at), settings),
  })), [visits, colorBy, settings]);
  const shown = useMemo(() => colored.filter((v) =>
    (statusF === "all" || asJobStatus(v) === statusF)
    && (!typeF || v.job_type_id === typeF)
    && (!techF.length || view === "dispatch" || techF.some((t) => (t === UNASSIGNED ? v.tech_ids.length === 0 : v.tech_ids.includes(t))))), [colored, statusF, typeF, techF, view]);

  // Horas visibles: el horario de trabajo, más lo necesario si hay trabajos antes o después
  const [visStart, visEnd] = useMemo(() => {
    // Lo que muestra el calendario (ej. 5 AM a 11 PM). Lo gris = fuera del horario de oficina.
    let a = Math.min(workStart, timeToMin(settings.cal_start ?? "05:00")), b = Math.max(workEnd, timeToMin(settings.cal_end ?? "23:00") || 24 * 60);
    shown.forEach((v) => {
      const s = new Date(v.starts_at), e = new Date(v.ends_at);
      if (s >= rangeStart && s < rangeEnd) a = Math.min(a, Math.floor(minutesOf(s) / 60) * 60);
      if (e > rangeStart && e <= rangeEnd && minutesOf(e) > 0) b = Math.max(b, Math.ceil(minutesOf(e) / 60) * 60);
      if (e > rangeEnd || (sameDay(s, e) === false && e <= rangeEnd)) b = 24 * 60;
    });
    return [Math.max(0, a), Math.min(24 * 60, b)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, workStart, workEnd, rangeKey, settings.cal_start, settings.cal_end]);

  // ---------- Columnas ----------
  // Solo técnicos (oficina y dueño aparecen únicamente si tienen un trabajo asignado en estas fechas)
  const techs = useMemo(() => team.filter((m) => receivesJobs(m) || visits.some((v) => v.tech_ids.includes(m.user_id))), [team, visits]);
  const cols: Col[] = useMemo(() => {
    if (view === "dispatch") {
      const list = techF.length ? techs.filter((m) => techF.includes(m.user_id)) : techs;
      const out: Col[] = list.map((m) => ({ key: `t:${m.user_id}`, day: anchor, techId: m.user_id, label: m.full_name, color: m.color, initials: m.initials, avatar: m.avatar_url }));
      if (!techF.length || techF.includes(UNASSIGNED)) out.push({ key: "t:none", day: anchor, techId: null, label: "Unassigned" });
      return out;
    }
    return days.map((d) => ({ key: isoDay(d), day: d, techId: null, label: d.toLocaleDateString("en-US", { weekday: "short" }), sub: String(d.getDate()), today: sameDay(d, now) }));
  }, [view, days, anchor, techs, techF, now]);

  const chipsFor = useCallback((ids: string[], lead: string | null): TechChip[] => ids.map((id) => {
    const m = team.find((x) => x.user_id === id);
    return { user_id: id, name: m?.full_name ?? "Technician", initials: m?.initials ?? "T", color: m?.color ?? "#94a3b8", avatar_url: m?.avatar_url ?? null, is_lead: id === (lead ?? ids[0]) };
  }), [team]);

  // ---------- Avisos (técnicos por push/correo y cliente por correo) ----------
  async function notify(body: Record<string, unknown>) {
    try {
      const r = await fetch("/api/jobs/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return (await r.json().catch(() => null)) as { customer?: { ok: boolean; reason: string | null } | null } | null;
    } catch { return null; }
  }
  async function notifyCustomerNow(v: CalVisit) {
    const r = await notify({ visitId: v.visit_id, notifyCustomer: true });
    const c = r?.customer;
    if (c?.ok) flash(`${v.customer_name} was notified by email`);
    else if (c?.reason === "no_email") flash(`${v.customer_name} has no email on file, so they weren't notified.`, "error");
    else flash("The email couldn't be sent. Check that email sending is set up (Resend).", "error");
  }

  // ---------- Acciones en la base de datos ----------
  async function saveVisit(v: CalVisit, start: Date, end: Date, techIds: string[] | null, lead: string | null, msg: string) {
    const before = visits;
    setVisits((vs) => vs.map((x) => (x.visit_id === v.visit_id ? {
      ...x, starts_at: start.toISOString(), ends_at: end.toISOString(),
      ...(techIds ? { tech_ids: techIds, techs: chipsFor(techIds, lead) } : {}),
    } : x)));
    const { error } = await createClient().rpc("visit_schedule", {
      p_visit: v.visit_id, p_starts: start.toISOString(), p_ends: end.toISOString(), p_window: null, p_techs: techIds, p_lead: lead,
    });
    if (error) { setVisits(before); flash(jobError(error), "error"); return; }
    flash(msg);
    load();
    const after = techIds ?? v.tech_ids;
    // Solo cuenta como "cambio de hora" si cambió el inicio (día u hora). Estirar la duración es interno: no se avisa a nadie.
    const moved = start.getTime() !== new Date(v.starts_at).getTime();
    notify({ visitId: v.visit_id, assigned: after.filter((t) => !v.tech_ids.includes(t)), unassigned: v.tech_ids.filter((t) => !after.includes(t)), moved });
    // ¿Avisar al cliente del cambio de hora?
    if (moved && v.customer_id) {
      if (settings.notify_customer === "always") notifyCustomerNow(v);
      else if (settings.notify_customer !== "never") setAsk({ v, start });
    }
  }
  // La oficina reanuda, pausa, termina o reabre (sin GPS; queda firmado en el historial)
  async function officeAction(v: CalVisit, a: OfficeAction) {
    if (a === "finish" && !(await askConfirm({ title: `Mark ${v.customer_name || v.number} as finished?`, message: "The job closes and shows as completed on the calendar.", confirmLabel: "Mark as finished", tone: "green" }))) return;
    setPop(null);
    const { error } = await createClient().rpc("job_office_action", { p_visit: v.visit_id, p_action: a, p_reason: null, p_note: null });
    if (error) { flash(error.hint || jobError(error), "error"); return; }
    flash({ resume: "Work resumed", pause: "Job paused", finish: "Job marked as finished", reopen: "Job reopened" }[a]);
    load();
  }
  async function unschedule(v: CalVisit) {
    setPop(null);
    setVisits((vs) => vs.filter((x) => x.visit_id !== v.visit_id));
    const { error } = await createClient().rpc("visit_unschedule", { p_visit: v.visit_id });
    if (error) flash(jobError(error), "error"); else flash(`${v.customer_name || v.number} moved to Unscheduled`);
    load();
  }
  async function scheduleFromTray(j: JobRow, start: Date, end: Date, techIds: string[] | null) {
    setTray((t) => t.filter((x) => x.id !== j.id));
    const { data: visitId, error } = await createClient().rpc("job_schedule", {
      p_job: j.id, p_starts: start.toISOString(), p_ends: end.toISOString(), p_window: null, p_techs: techIds, p_lead: techIds?.[0] ?? null,
    });
    if (error) flash(jobError(error), "error");
    else {
      flash(`${j.customer_name || j.number} scheduled for ${fmtDayShort(start)} at ${fmtTime(start)}`);
      if (visitId) notify({ visitId, assignAll: true });
    }
    load();
  }
  function newJobAt(day: Date, startMin: number, endMin: number, techId: string | null) {
    const s = atMinute(day, startMin), e = atMinute(day, endMin);
    const q = new URLSearchParams({ start: s.toISOString(), end: e.toISOString() });
    if (techId) q.set("tech", techId);
    router.push(`/dashboard/jobs/new?${q.toString()}`);
  }

  // ---------- Arrastrar y soltar (mouse y dedo) ----------
  const snap = (m: number) => Math.round(m / slot) * slot;

  function computePreview(s: DragState, hit: Hit | null): Preview {
    if (!hit) return null;
    if (hit.minute === null) {
      if (s.kind === "move" || s.kind === "tray") return { colKey: hit.colKey, day: hit.day, startMin: 0, endMin: 0, color: s.color, label: s.label };
      return null;
    }
    if (s.kind === "move" || s.kind === "tray") {
      const start = Math.min(24 * 60 - s.durMin, Math.max(0, snap(hit.minute - s.offsetMin)));
      return { colKey: hit.colKey, day: hit.day, startMin: start, endMin: start + s.durMin, color: s.color, label: s.label };
    }
    if (s.kind === "resize" && s.col) {
      const end = Math.min(24 * 60, Math.max(s.startMin + slot, snap(hit.minute)));
      return { colKey: s.col.key, day: s.col.day, startMin: s.startMin, endMin: end, color: s.color, label: s.label };
    }
    if (s.kind === "create" && s.col) {
      const a = Math.floor(s.startMin / slot) * slot, b = snap(hit.minute);
      return b > a ? { colKey: s.col.key, day: s.col.day, startMin: a, endMin: Math.max(a + slot, b), color: s.color, label: s.label }
        : { colKey: s.col.key, day: s.col.day, startMin: b, endMin: a + slot, color: s.color, label: s.label };
    }
    return null;
  }

  function activate() {
    const s = drag.current; if (!s || s.active || s.locked) return;
    s.active = true;
    setDraggingId(s.visit?.visit_id ?? s.job?.id ?? null);
    setPop(null); clearTimeout(hoverT.current);
    document.body.style.userSelect = "none";
    if (s.touch) navigator.vibrate?.(12);
    const hit = apiRef.current?.hit(s.lastX, s.lastY) ?? null;
    s.hit = hit; s.preview = computePreview(s, hit); setPreview(s.preview);
  }

  function moveImpl(ev: PointerEvent) {
    const s = drag.current; if (!s || ev.pointerId !== s.pointerId) return;
    const dist = Math.hypot(ev.clientX - s.x0, ev.clientY - s.y0);
    if (s.locked) { if (dist > 6) s.scrolled = true; return; } // terminada o cancelada: solo se abre, no se mueve
    if (!s.active) {
      if (!s.touch && dist > 4) activate();
      else if (s.touch && dist > 8) {
        clearTimeout(s.timer);
        if (s.kind !== "create") {
          // Antes de mantener presionado: el dedo desplaza la lista o el calendario (no arrastra)
          const sc = s.kind === "tray" ? (trayRef.current?.querySelector("[data-tray-list]") as HTMLElement | null) : apiRef.current?.scroller();
          if (sc) { sc.scrollTop -= ev.clientY - s.lastY; sc.scrollLeft -= ev.clientX - s.lastX; }
        }
        s.scrolled = true;
      }
      if (!s.active) { s.lastX = ev.clientX; s.lastY = ev.clientY; return; }
    }
    s.lastX = ev.clientX; s.lastY = ev.clientY;
    const tr = trayRef.current?.getBoundingClientRect();
    s.overTray = Boolean(tr && s.kind === "move" && s.visit?.visit_status === "scheduled" && ev.clientX >= tr.left && ev.clientX <= tr.right && ev.clientY >= tr.top && ev.clientY <= tr.bottom);
    setTrayDrop(Boolean(s.overTray));
    const hit = s.overTray ? null : apiRef.current?.hit(ev.clientX, ev.clientY) ?? null;
    s.hit = hit; s.preview = computePreview(s, hit); setPreview(s.preview);
    // Auto-desplazamiento cerca de los bordes
    const sc = apiRef.current?.scroller();
    if (sc && !s.overTray && view !== "month") {
      const r = sc.getBoundingClientRect();
      if (ev.clientY < r.top + 56) sc.scrollTop -= 14; else if (ev.clientY > r.bottom - 36) sc.scrollTop += 14;
      if (ev.clientX > r.right - 30) sc.scrollLeft += 14; else if (ev.clientX < r.left + 70 && sc.scrollLeft > 0) sc.scrollLeft -= 14;
    }
  }

  function finishImpl(ev: PointerEvent, cancelled: boolean) {
    const s = drag.current; if (!s || ev.pointerId !== s.pointerId) return;
    clearTimeout(s.timer);
    drag.current = null;
    const l = listeners.current;
    window.removeEventListener("pointermove", l.move);
    window.removeEventListener("pointerup", l.up);
    window.removeEventListener("pointercancel", l.cancel);
    window.removeEventListener("touchmove", l.touch);
    document.body.style.userSelect = "";
    setDraggingId(null); setPreview(null); setTrayDrop(false);
    if (pendingReload.current) { pendingReload.current = false; setTimeout(() => load(), 50); }
    if (cancelled) return;

    if (!s.active) {
      if (s.scrolled) return;
      // Clic sin arrastrar
      if ((s.kind === "move" || s.kind === "resize") && s.visit && s.el) { clearTimeout(hoverT.current); setPop({ v: s.visit, rect: s.el.getBoundingClientRect(), pinned: true }); return; }
      if (s.kind === "tray" && s.job) { router.push(`/dashboard/jobs/${s.job.id}/edit`); return; }
      if (s.kind === "create" && s.col) {
        const a = view === "month" ? workStart : Math.floor(s.startMin / slot) * slot;
        openDraft(s.col, a, a + settings.default_duration_min, ev.clientX, ev.clientY);
      }
      return;
    }

    if (s.overTray && s.visit) { unschedule(s.visit); return; }
    const p = s.preview, hit = s.hit;
    if (!p) return;
    if (s.kind === "create" && s.col) { openDraft({ ...s.col, day: p.day }, p.startMin, p.endMin, ev.clientX, ev.clientY); return; }

    if (s.kind === "tray" && s.job) {
      const start = view === "month" ? atMinute(p.day, workStart) : atMinute(p.day, p.startMin);
      scheduleFromTray(s.job, start, addMinutes(start, s.durMin), view === "dispatch" && hit?.techId ? [hit.techId] : null);
      return;
    }
    const v = s.visit; if (!v) return;
    const oldStart = new Date(v.starts_at), oldEnd = new Date(v.ends_at);
    const dur = Math.round((oldEnd.getTime() - oldStart.getTime()) / 60000);
    let start: Date, end: Date;
    if (s.kind === "resize") { start = oldStart; end = atMinute(p.day, p.endMin); }
    else if (view === "month") { start = atMinute(p.day, minutesOf(oldStart)); end = addMinutes(start, dur); }
    else { start = atMinute(p.day, p.startMin); end = addMinutes(start, dur); }

    // Dispatch: soltar en el carril de otro técnico cambia el técnico
    let techIds: string[] | null = null, lead: string | null = null, techMsg = "";
    if (view === "dispatch" && s.kind === "move" && s.col && hit && hit.techId !== s.col.techId) {
      const from = s.col.techId, to = hit.techId;
      const set = v.tech_ids.filter((t) => t !== from);
      if (to && !set.includes(to)) set.push(to);
      techIds = set;
      const curLead = v.techs.find((t) => t.is_lead)?.user_id ?? null;
      lead = to && (!from || curLead === from) ? to : curLead && set.includes(curLead) ? curLead : set[0] ?? null;
      techMsg = to ? ` · assigned to ${team.find((m) => m.user_id === to)?.full_name ?? "technician"}` : " · unassigned";
    }
    if (start.getTime() === oldStart.getTime() && end.getTime() === oldEnd.getTime() && !techIds) return;
    const who = v.customer_name || v.number;
    saveVisit(v, start, end, techIds, lead, s.kind === "resize" ? `${who}: now ${fmtTime(start)} – ${fmtTime(end)}` : `${who} moved to ${fmtDayShort(start)}, ${fmtTime(start)}${techMsg}`);
  }

  // Los escuchas de la ventana son fijos y siempre llaman a la versión más nueva (sin datos viejos)
  const impl = useRef({ move: moveImpl, finish: finishImpl, activate });
  impl.current = { move: moveImpl, finish: finishImpl, activate };
  const listeners = useRef({
    move: (e: PointerEvent) => impl.current.move(e),
    up: (e: PointerEvent) => impl.current.finish(e, false),
    cancel: (e: PointerEvent) => impl.current.finish(e, true),
    touch: (e: TouchEvent) => { if (drag.current?.active) e.preventDefault(); },
  });

  // Clic o arrastre en un espacio vacío: primero una tarjetita para confirmar (nunca abre el formulario solo)
  function openDraft(col: Col, startMin: number, endMin: number, x: number, y: number) {
    setDraft({ day: col.day, startMin, endMin, techId: col.techId, x, y });
    setPreview({ colKey: col.key, day: col.day, startMin, endMin, color: "#0f766e", label: "New job" });
  }
  function closeDraft() { setDraft(null); setPreview(null); }

  function begin(e: React.PointerEvent, s: Omit<DragState, "pointerId" | "touch" | "x0" | "y0" | "lastX" | "lastY" | "active" | "scrolled">) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Un solo arrastre por toque: si una barra ya lo tomó, el fondo no crea otro
    const nat = e.nativeEvent as PointerEvent & { __bp?: boolean };
    if (nat.__bp) return;
    nat.__bp = true;
    if (draft) closeDraft();
    if (e.pointerType === "mouse") e.preventDefault();
    const touch = e.pointerType !== "mouse";
    drag.current = { ...s, pointerId: e.pointerId, touch, x0: e.clientX, y0: e.clientY, lastX: e.clientX, lastY: e.clientY, active: false, scrolled: false };
    const l = listeners.current;
    window.addEventListener("pointermove", l.move);
    window.addEventListener("pointerup", l.up);
    window.addEventListener("pointercancel", l.cancel);
    if (touch) {
      window.addEventListener("touchmove", l.touch, { passive: false });
      // Con el dedo: mantener presionado un momento para agarrar la barra
      if (s.kind !== "create" && !s.locked) drag.current.timer = setTimeout(() => impl.current.activate(), 280);
    }
  }

  const handlers: Handlers = {
    draggingId,
    onVisitDown: (e, v, col, mode) => {
      const vs = new Date(v.starts_at), ve = new Date(v.ends_at);
      const startMin = sameDay(vs, col.day) ? minutesOf(vs) : 0;
      const hit = apiRef.current?.hit(e.clientX, e.clientY);
      begin(e, {
        kind: mode, el: e.currentTarget as HTMLElement, visit: v, col, locked: v.visit_status === "completed" || v.visit_status === "cancelled",
        offsetMin: hit?.minute != null ? hit.minute - startMin : 0, durMin: Math.max(slot, Math.round((ve.getTime() - vs.getTime()) / 60000)), startMin,
        color: barColor(v), label: v.customer_name || v.number,
      });
    },
    onEmptyDown: (e, col, minute) => {
      begin(e, { kind: "create", col, offsetMin: 0, durMin: settings.default_duration_min, startMin: minute ?? workStart, color: "#0f766e", label: "New job" });
    },
    onVisitHover: (v, el) => {
      if (drag.current?.active) return;
      clearTimeout(hoverT.current); clearTimeout(hideT.current);
      if (v && el) hoverT.current = setTimeout(() => setPop((p) => (p?.pinned ? p : { v, rect: el.getBoundingClientRect(), pinned: false })), 380);
      else hideT.current = setTimeout(() => setPop((p) => (p?.pinned ? p : null)), 200);
    },
  };

  function onTrayDown(e: React.PointerEvent, j: JobRow) {
    begin(e, {
      kind: "tray", job: j, offsetMin: 15, durMin: (j.job_type_id && typeDur.get(j.job_type_id)) || settings.default_duration_min, startMin: 0,
      color: j.type_color ?? "#0f766e", label: j.customer_name || j.number,
    });
  }

  // Cerrar la tarjeta fija al tocar afuera · Esc cancela
  useEffect(() => {
    if (!pop?.pinned) return;
    const close = () => setPop(null);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPop(null); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", esc); window.removeEventListener("resize", close); };
  }, [pop?.pinned]);

  const toggleTray = () => setTrayOpen((o) => { try { localStorage.setItem(TRAY_KEY, o ? "0" : "1"); } catch { /* */ } return !o; });
  const trayCount = tray.length;
  const holdCount = tray.filter((j) => j.status === "on_hold").length;
  const scrollTo = days.some((d) => sameDay(d, now)) ? Math.max(visStart, minutesOf(now) - 90) : Math.max(visStart, workStart - 30);

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col bg-white">
      {/* Barra de herramientas: fecha a la izquierda; Vista, Filtros, bandeja y Nuevo a la derecha */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 px-2.5 py-2 sm:gap-2 sm:px-3 lg:px-5 lg:py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button type="button" onClick={() => setAnchor(dayStart(new Date()))}
            className="h-11 shrink-0 rounded-xl border border-slate-200 px-3.5 text-[15px] sm:h-9 sm:rounded-lg sm:px-2.5 sm:text-[13.5px] font-semibold text-slate-700 transition-colors hover:border-[#14a39a] hover:bg-[#f3fbf8]">Today</button>
          {([-1, 1] as const).map((d) => (
            <button key={d} type="button" aria-label={d < 0 ? "Previous" : "Next"} onClick={() => setAnchor((a) => shiftAnchor(view, a, d))}
              className="hidden h-9 w-8 shrink-0 sm:flex items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d < 0 ? "m12 5-5 5 5 5" : "m8 5 5 5-5 5"} /></svg>
            </button>
          ))}
          <DateJump label={rangeLabel(view, anchor, settings.week_starts_on)} anchor={anchor} days={days} weekStartsOn={settings.week_starts_on}
            onPick={(d) => setAnchor(d)} />
          {loading && <span className="ml-1 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#14a39a] border-t-transparent" aria-label="Loading" />}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <ViewMenu value={view} onChange={setView} />
          <FiltersMenu statusF={statusF} setStatusF={setStatusF} counts={counts} team={techs} techF={techF} setTechF={setTechF}
            types={types.filter((t) => t.is_active)} typeF={typeF} setTypeF={setTypeF}
            colorBy={colorBy} setColorBy={(v) => { setColorBy(v); try { localStorage.setItem(COLOR_KEY, v); } catch { /* */ } }} />
          <button type="button" onClick={toggleTray} aria-pressed={trayOpen} aria-label="To schedule" title="To schedule"
            className={`relative flex h-11 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-xl border px-2.5 text-[13px] font-semibold transition-colors sm:h-9 sm:min-w-0 sm:rounded-lg ${trayOpen ? "border-[#0f766e] bg-[#e9f7f4] text-[#0f766e]" : "border-slate-200 text-slate-700 hover:border-[#14a39a]"}`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v14H4zM15 5v14" /></svg>
            <span className="hidden xl:inline">To schedule</span>
            {trayCount > 0 && <span className={`rounded-full px-1.5 text-[11px] text-white ${holdCount ? "bg-[#e11d48]" : "bg-[#0f766e]"}`}>{trayCount}</span>}
          </button>
          <Link prefetch={false} href="/dashboard/jobs/new" aria-label="New job"
            className="group/n inline-flex h-11 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-xl bg-[#0f766e] px-2.5 text-[14px] sm:h-9 sm:min-w-0 sm:rounded-lg font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59] sm:px-3.5">
            <svg viewBox="0 0 20 20" className="h-6 w-6 transition-transform duration-200 group-hover/n:rotate-90 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
            <span className="hidden sm:inline">New job</span>
          </Link>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {view === "dispatch" ? (
            <DispatchGrid days={days} rows={cols} visits={shown} dStart={visStart} dEnd={visEnd} preview={preview} handlers={handlers} apiRef={apiRef} now={now} />
          ) : view === "month" ? (
            <MonthGrid days={days} month={anchor.getMonth()} visits={shown} preview={preview} handlers={handlers} apiRef={apiRef} now={now}
              onOpenDay={(d) => { setAnchor(d); setView("day"); }} />
          ) : (
            <TimeGrid cols={cols} visits={shown} visStart={visStart} visEnd={visEnd} workStart={workStart} workEnd={workEnd} slot={slot}
              preview={preview} handlers={handlers} apiRef={apiRef} now={now} dispatch={false} scrollTo={scrollTo} />
          )}
          {!loading && visits.length === 0 && view !== "month" && (
            <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-[13px] text-slate-500 shadow-sm ring-1 ring-slate-200">
              No jobs here yet. Click or drag on an empty time to create one.
            </div>
          )}
        </div>

        {/* Bandeja: panel a la derecha en computadora; pantalla encima en celular */}
        {trayOpen && (
          <>
            <button type="button" aria-label="Close panel" onClick={toggleTray} className="fixed inset-0 z-30 bg-slate-900/25 lg:hidden" />
            <aside className="fixed inset-y-0 right-0 z-40 w-[86%] max-w-[22rem] shadow-2xl animate-[bp-in-left_0.2s_ease-out] lg:static lg:z-auto lg:w-72 lg:max-w-none lg:border-l lg:border-slate-200 lg:shadow-none lg:animate-none">
              <JobTray jobs={tray} trayRef={trayRef} draggingId={draggingId} dropActive={trayDrop} onDown={onTrayDown} onClose={toggleTray} />
            </aside>
          </>
        )}
      </div>

      {pop && (
        <VisitPopover v={pop.v} rect={pop.rect} pinned={pop.pinned} canSeeMoney={canSeeMoney}
          onClose={() => setPop(null)} onUnschedule={unschedule} onAction={officeAction}
          onEnter={() => { clearTimeout(hideT.current); }}
          onLeave={() => { if (!pop.pinned) hideT.current = setTimeout(() => setPop((p) => (p?.pinned ? p : null)), 200); }} />
      )}

      {draft && (
        <DraftCard draft={draft} techName={draft.techId ? team.find((m) => m.user_id === draft.techId)?.full_name ?? null : null}
          onCreate={() => { newJobAt(draft.day, draft.startMin, draft.endMin, draft.techId); }} onClose={closeDraft} />
      )}

      {ask && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-900/30 p-4 animate-[bp-fade_0.15s_ease-out]" onPointerDown={(e) => e.stopPropagation()}>
          <div role="alertdialog" aria-labelledby="notify-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_24px_60px_rgba(15,40,60,0.3)] animate-[bp-pop-in_0.18s_ease-out]">
            <h2 id="notify-title" className="text-[18px] font-semibold text-[#0b1f3a]">Notify customer of schedule change?</h2>
            <p className="mt-3 rounded-xl bg-[#f3fbf8] px-4 py-3 text-[13.5px] text-slate-700">
              <b className="font-semibold text-[#0b1f3a]">{ask.v.customer_name}</b> will get an email with the new time: {fmtDayShort(ask.start)} at {fmtTime(ask.start)}.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setAsk(null)} className="rounded-lg px-4 py-2 text-[14px] font-semibold text-slate-600 hover:bg-slate-100">Don&apos;t notify</button>
              <button type="button" autoFocus onClick={() => { const v = ask.v; setAsk(null); notifyCustomerNow(v); }}
                className="rounded-lg bg-[#0f766e] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#0c5f59]">Notify customer</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className={`fixed bottom-5 left-1/2 z-[95] max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium shadow-[0_14px_36px_rgba(15,40,60,0.25)] animate-[bp-pop-in_0.2s_ease-out] ${toast.tone === "error" ? "bg-[#be123c] text-white" : "bg-[#0b1f3a] text-white"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ---------- Vista y Filtros (Headless UI) ----------
const btn = "flex h-11 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 sm:h-9 sm:min-w-0 sm:rounded-lg text-[13px] font-semibold text-slate-700 transition-colors hover:border-[#14a39a] focus:outline-none data-[open]:border-[#0f766e] data-[open]:ring-4 data-[open]:ring-[#14a39a]/15";
const VIEW_ICON: Record<CalView, string> = {
  day: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15h6", week: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 10v10M14 10v10",
  workweek: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M10 10v10M15 10v10", month: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M4 15h16M9 10v10M14 10v10",
  dispatch: "M4 6h16M4 12h16M4 18h16M8 4v4M13 10v4M10 16v4",
};
function ViewMenu({ value, onChange }: { value: CalView; onChange: (v: CalView) => void }) {
  return (
    <Listbox value={value} onChange={onChange}>
      <ListboxButton className={btn} aria-label="Calendar view">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#0f766e] sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={VIEW_ICON[value]} /></svg>
        <span className="hidden sm:inline">{VIEWS.find((v) => v.id === value)?.label}</span>
        <span className="hidden text-slate-400 sm:inline"><Chevron /></span>
      </ListboxButton>
      <ListboxOptions anchor="bottom end" transition className={`${panelClass} w-48`}>
        {VIEWS.map((v) => (
          <ListboxOption key={v.id} value={v.id} className={optionClass}>
            <span className="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400 group-data-[selected]:text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={VIEW_ICON[v.id]} /></svg>
              {v.label}
            </span>
            <Check />
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}

function FiltersMenu({ statusF, setStatusF, counts, team, techF, setTechF, types, typeF, setTypeF, colorBy, setColorBy }: {
  statusF: "all" | JobStatus; setStatusF: (v: "all" | JobStatus) => void; counts: Map<string, number>;
  team: TeamMember[]; techF: string[]; setTechF: (v: string[]) => void; types: JobType[]; typeF: string; setTypeF: (v: string) => void;
  colorBy: ColorBy; setColorBy: (v: ColorBy) => void;
}) {
  const active = (statusF !== "all" ? 1 : 0) + (techF.length ? 1 : 0) + (typeF ? 1 : 0);
  const chip = (on: boolean) => `rounded-full border px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${on ? "border-[#0f766e] bg-[#e9f7f4] text-[#0f766e]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`;
  const statuses: ("all" | JobStatus)[] = ["all", ...STATUS_ORDER.filter((x) => x !== "unscheduled")];
  const toggleTech = (id: string) => setTechF(techF.includes(id) ? techF.filter((t) => t !== id) : [...techF, id]);
  return (
    <Popover className="relative">
      <PopoverButton className={btn} aria-label="Filters">
        <svg viewBox="0 0 24 24" className="h-6 w-6 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        <span className="hidden sm:inline">Filters</span>
        {active > 0 && <span className="rounded-full bg-[#0f766e] px-1.5 text-[11px] text-white">{active}</span>}
      </PopoverButton>
      <PopoverPanel anchor="bottom end" transition
        className="z-[100] mt-2 max-h-[min(34rem,calc(100dvh-7rem))] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_48px_rgba(15,40,60,0.2)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold text-[#0b1f3a]">Filters</p>
          {active > 0 && <button type="button" onClick={() => { setStatusF("all"); setTechF([]); setTypeF(""); }} className="text-[13px] font-semibold text-[#0f766e] hover:underline">Clear all</button>}
        </div>

        <p className="mb-2 mt-4 text-[12.5px] font-semibold text-slate-500">Status</p>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((x) => (
            <button key={x} type="button" onClick={() => setStatusF(x)} className={chip(statusF === x)}>
              {x === "all" ? "All" : STATUS_META[x].label} <span className="font-normal text-slate-400">{counts.get(x) ?? 0}</span>
            </button>
          ))}
        </div>

        <p className="mb-2 mt-4 text-[12.5px] font-semibold text-slate-500">Technicians</p>
        <div className="space-y-0.5">
          {team.length === 0 && <p className="text-[13px] text-slate-400">No technicians yet.</p>}
          {[...team.map((m) => ({ id: m.user_id, m })), { id: UNASSIGNED, m: null }].map(({ id, m }) => {
            const on = techF.includes(id);
            return (
              <button key={id} type="button" onClick={() => toggleTech(id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-50">
                <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border ${on ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-slate-300"}`}>
                  {on && <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 10.5 3 3 7-7" /></svg>}
                </span>
                {m ? <TechDot t={m} size={22} ring={false} /> : <span className="h-[22px] w-[22px] rounded-full border border-dashed border-slate-300" />}
                <span className="truncate">{m ? m.full_name : "Unassigned"}</span>
              </button>
            );
          })}
        </div>

        {types.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-[12.5px] font-semibold text-slate-500">Job type</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setTypeF("")} className={chip(!typeF)}>All</button>
              {types.map((t) => (
                <button key={t.id} type="button" onClick={() => setTypeF(typeF === t.id ? "" : t.id)} className={`${chip(typeF === t.id)} flex items-center gap-1.5`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />{t.name}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="mb-2 mt-4 text-[12.5px] font-semibold text-slate-500">Color bars by</p>
        <div className="flex rounded-lg bg-slate-100 p-0.5">
          {([["tech", "Technician"], ["type", "Job type"], ["priority", "Priority"]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setColorBy(v)}
              className={`flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-semibold transition-all ${colorBy === v ? "bg-white text-[#0f766e] shadow-sm" : "text-slate-500 hover:text-[#0b1f3a]"}`}>{l}</button>
          ))}
        </div>
      </PopoverPanel>
    </Popover>
  );
}

// ---------- Tarjetita "New job" al dar clic o arrastrar en un espacio vacío ----------
function DraftCard({ draft, techName, onCreate, onClose }: {
  draft: { day: Date; startMin: number; endMin: number; x: number; y: number }; techName: string | null; onCreate: () => void; onClose: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "Enter") onCreate(); };
    const out = () => onClose();
    window.addEventListener("keydown", esc);
    const t = setTimeout(() => window.addEventListener("pointerdown", out), 0);
    return () => { window.removeEventListener("keydown", esc); window.removeEventListener("pointerdown", out); clearTimeout(t); };
  }, [onClose, onCreate]);
  const W = 260;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200, vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.min(Math.max(12, draft.x + 14), vw - W - 12), top = Math.min(Math.max(12, draft.y - 20), vh - 170);
  const s = atMinute(draft.day, draft.startMin), e = atMinute(draft.day, draft.endMin);
  return (
    <div role="dialog" aria-label="New job" onPointerDown={(ev) => ev.stopPropagation()}
      className="fixed z-[92] rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_18px_48px_rgba(15,40,60,0.22)] animate-[bp-pop-in_0.14s_ease-out]" style={{ left, top, width: W }}>
      <p className="text-[15px] font-semibold text-[#0b1f3a]">New job</p>
      <p className="mt-0.5 text-[13px] text-slate-600">{fmtDayShort(s)} · {fmtTime(s)} – {fmtTime(e)}</p>
      {techName && <p className="text-[12.5px] text-slate-500">For {techName}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" autoFocus onClick={onCreate} className="flex-1 rounded-lg bg-[#0f766e] px-3 py-2 text-[13.5px] font-semibold text-white hover:bg-[#0c5f59]">Create job</button>
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
      </div>
    </div>
  );
}

// ---------- Clic en la fecha: calendario para saltar a cualquier día ----------
function DateJump({ label, anchor, days, weekStartsOn, onPick }: { label: string; anchor: Date; days: Date[]; weekStartsOn: number; onPick: (d: Date) => void }) {
  const [cursor, setCursor] = useState(() => startOfMonth(anchor));
  useEffect(() => setCursor(startOfMonth(anchor)), [anchor]);
  const first = startOfWeek(cursor, weekStartsOn);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const dow = Array.from({ length: 7 }, (_, i) => addDays(first, i).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2));
  const inRange = (d: Date) => days.length < 42 && d >= days[0] && d <= days[days.length - 1];
  const today = new Date();
  return (
    <Popover className="relative min-w-0">
      <PopoverButton aria-label={label} title={label} className="group ml-0.5 flex h-11 w-11 min-w-0 items-center justify-center gap-1 rounded-xl border border-slate-200 px-2 py-1 sm:h-9 sm:w-auto sm:justify-start sm:rounded-lg sm:border-transparent text-left transition-colors hover:bg-slate-100 focus:outline-none data-[open]:bg-[#e9f7f4]">
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-[#0f766e] sm:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" /></svg>
        <span className="hidden truncate whitespace-nowrap text-[17px] font-semibold tracking-tight text-[#0b1f3a] sm:inline lg:text-[19px]">{label}</span>
        <svg viewBox="0 0 20 20" className="hidden h-4 w-4 text-slate-500 transition-transform duration-200 group-data-[open]:rotate-180 sm:block" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </PopoverButton>
      <PopoverPanel anchor="bottom start" transition className="z-[100] mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_16px_44px_rgba(15,40,60,0.2)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => (
          <>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[14.5px] font-semibold text-[#0b1f3a]">{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
              <div className="flex">
                {([-1, 1] as const).map((d) => (
                  <button key={d} type="button" aria-label={d < 0 ? "Previous month" : "Next month"} onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + d, 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d < 0 ? "m12 5-5 5 5 5" : "m8 5 5 5-5 5"} /></svg></button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-slate-400">{dow.map((d, i) => <span key={i} className="py-1">{d}</span>)}</div>
            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {cells.map((d) => {
                const out = d.getMonth() !== cursor.getMonth(), on = inRange(d), t = sameDay(d, today), sel = sameDay(d, anchor);
                return (
                  <button key={isoDay(d)} type="button" onClick={() => { onPick(dayStart(d)); close(); }}
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[13px] transition-colors ${sel ? "bg-[#0f766e] font-semibold text-white" : on ? "bg-[#dff3ee] font-medium text-[#0f766e]" : t ? "font-semibold text-[#0f766e] ring-1 ring-[#0f766e]" : out ? "text-slate-300 hover:bg-slate-50" : "text-slate-700 hover:bg-slate-100"}`}>
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => { onPick(dayStart(new Date())); close(); }} className="mt-2 w-full rounded-lg py-1.5 text-[13px] font-semibold text-[#0f766e] hover:bg-[#f3fbf8]">Go to today</button>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
