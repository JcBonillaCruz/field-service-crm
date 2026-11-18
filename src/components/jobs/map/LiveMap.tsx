"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createClient } from "@/lib/supabase/client";
import { CalVisit, TeamMember, UNASSIGNED_COLOR, VISIT_LABEL, addDays, addressLine, dayStart, fmtTime, isoDay, leadOf, sameDay } from "@/lib/jobs";
import { GeoRow, LiveRow, RoutePoint, TILE_ATTR, TILE_URL, agoLabel, esc, isFresh, needsMapSql } from "@/lib/live-map";

// =====================================================================
// Paso 5.9 · Vista "Map" del Schedule (solo dueño, manager y oficina).
//  · Cada persona con el día iniciado, en su color, con "hace cuánto" se supo de ella.
//  · Los trabajos del día como pines numerados en el orden de la visita.
//  · Al elegir a una persona: por dónde pasó (línea) y las paradas que le faltan (línea punteada).
//  · Las coordenadas de cada dirección se buscan una sola vez y quedan guardadas.
// =====================================================================
type Person = { id: string; name: string; initials: string; color: string; live: LiveRow | null; status: string; tone: "way" | "work" | "free" | "off"; stops: Stop[] };
type Stop = { v: CalVisit; no: number; lat: number | null; lng: number | null; why: "" | "no_address" | "not_found" | "searching" };

const DONE = "#94a3b8";
const pinHtml = (s: Stop, color: string) => {
  const st = s.v.visit_status, done = st === "completed", active = st === "in_progress" || st === "on_my_way" || st === "paused";
  return `<div class="bp-pin${active ? " bp-pin-on" : ""}" style="--c:${done ? DONE : color}">${done
    ? '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 10.5 3.5 3.5 7.5-8"/></svg>'
    : `<span>${s.no || "•"}</span>`}</div>`;
};
const techHtml = (p: Person, fresh: boolean) =>
  `<div class="bp-tech${fresh ? " bp-tech-live" : " bp-tech-old"}" style="--c:${p.color}"><span>${esc(p.initials)}</span></div>`;

export default function LiveMap({ companyId, day, visits, team }: { companyId: string; day: Date; visits: CalVisit[]; team: TeamMember[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layers = useRef<{ stops: L.LayerGroup; techs: L.LayerGroup; route: L.LayerGroup } | null>(null);
  const fitted = useRef("");
  const asked = useRef<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState<LiveRow[]>([]);
  const [geo, setGeo] = useState<Record<string, GeoRow>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [needSql, setNeedSql] = useState(false);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);       // celular: lista abierta
  const [showMissing, setShowMissing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const dayKey = isoDay(day);
  const isToday = sameDay(day, new Date(now));

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  // ---------- Mapa ----------
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, { zoomControl: false, attributionControl: true }).setView([39.5, -98.35], 4);
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTR }).addTo(map);
    layers.current = { route: L.layerGroup().addTo(map), stops: L.layerGroup().addTo(map), techs: L.layerGroup().addTo(map) };
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(boxRef.current);
    setReady(true);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; layers.current = null; };
  }, []);

  // ---------- Posiciones en vivo ----------
  const loadLive = useCallback(async () => {
    const { data, error } = await createClient().rpc("tech_live", { p_company: companyId });
    if (error) { if (needsMapSql(error)) setNeedSql(true); return; }
    setNeedSql(false);
    setLive(((data ?? []) as LiveRow[]).map((r) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) })));
  }, [companyId]);
  useEffect(() => {
    loadLive();
    const sb = createClient();
    let t: ReturnType<typeof setTimeout>;
    const again = () => { clearTimeout(t); t = setTimeout(loadLive, 400); };
    const ch = sb.channel(`live-map-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tech_last_location", filter: `company_id=eq.${companyId}` }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "tech_time_entries", filter: `company_id=eq.${companyId}` }, again)
      .subscribe();
    const iv = setInterval(() => { if (document.visibilityState === "visible") loadLive(); }, 60000);
    return () => { clearTimeout(t); clearInterval(iv); sb.removeChannel(ch); };
  }, [companyId, loadLive]);

  // ---------- Trabajos del día y sus coordenadas ----------
  const dayVisits = useMemo(() => visits
    .filter((v) => sameDay(new Date(v.starts_at), day) && v.job_status !== "cancelled" && v.visit_status !== "cancelled" && v.visit_status !== "unscheduled")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visits, dayKey]);
  const addrIds = useMemo(() => Array.from(new Set(dayVisits.map((v) => v.address_id).filter((x): x is string => Boolean(x)))).sort(), [dayVisits]);
  const addrKey = addrIds.join(",");

  const geocode = useCallback(async (ids: string[], retry = false) => {
    if (!ids.length) return;
    setSearching(true);
    for (let i = 0; i < ids.length; i += 6) {
      try {
        const r = await fetch("/api/jobs/geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: ids.slice(i, i + 6), retry }) });
        const j = await r.json() as { done?: GeoRow[]; needsSql?: boolean };
        if (j.needsSql) setNeedSql(true);
        if (j.done?.length) setGeo((g) => ({ ...g, ...Object.fromEntries(j.done!.map((x) => [x.id, x])) }));
        if (!r.ok) break;
      } catch { break; }
    }
    setSearching(false);
  }, []);
  useEffect(() => {
    if (!addrIds.length) return;
    let off = false;
    (async () => {
      const { data, error } = await createClient().from("customer_addresses").select("id, lat, lng, geo_status").in("id", addrIds);
      if (off) return;
      if (error) { if (needsMapSql(error)) setNeedSql(true); return; }
      const rows = (data ?? []) as GeoRow[];
      setGeo((g) => ({ ...g, ...Object.fromEntries(rows.map((x) => [x.id, x])) }));
      const pending = rows.filter((x) => x.lat === null && !x.geo_status && !asked.current.has(x.id)).map((x) => x.id);
      pending.forEach((id) => asked.current.add(id));
      geocode(pending);
    })();
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrKey, geocode]);

  // ---------- Personas y paradas ----------
  const people: Person[] = useMemo(() => {
    const liveOf = new Map(live.map((r) => [r.user_id, r]));
    const ids = new Set<string>();
    team.forEach((m) => { if ((m.can_receive ?? m.role === "technician") || liveOf.has(m.user_id) || dayVisits.some((v) => v.tech_ids.includes(m.user_id))) ids.add(m.user_id); });
    const stopOf = (v: CalVisit, no: number): Stop => {
      const g = v.address_id ? geo[v.address_id] : undefined;
      const has = g && g.lat !== null && g.lng !== null;
      return { v, no, lat: has ? Number(g!.lat) : null, lng: has ? Number(g!.lng) : null, why: has ? "" : !v.address_id || !addressLine(v.site_address) ? "no_address" : g?.geo_status === "not_found" ? "not_found" : "searching" };
    };
    return team.filter((m) => ids.has(m.user_id)).map((m) => {
      const mine = dayVisits.filter((v) => v.tech_ids.includes(m.user_id));
      const cur = visits.find((v) => v.tech_ids.includes(m.user_id) && (v.visit_status === "on_my_way" || v.visit_status === "in_progress" || v.visit_status === "paused"));
      const lv = liveOf.get(m.user_id) ?? null;
      const [status, tone]: [string, Person["tone"]] = cur?.visit_status === "on_my_way" ? [`On the way · ${cur.customer_name}`, "way"]
        : cur?.visit_status === "in_progress" ? [`Working · ${cur.customer_name}`, "work"]
        : cur?.visit_status === "paused" ? [`Paused · ${cur.customer_name}`, "work"]
        : lv?.on_shift ? ["Available", "free"] : lv ? ["Day ended", "off"] : ["No location yet", "off"];
      return { id: m.user_id, name: m.full_name, initials: m.initials, color: m.color, live: lv, status, tone, stops: mine.map((v, i) => stopOf(v, i + 1)) };
    }).sort((a, b) => Number(Boolean(b.live?.on_shift)) - Number(Boolean(a.live?.on_shift)) || a.name.localeCompare(b.name));
  }, [team, live, dayVisits, visits, geo]);

  // Pines a pintar: con una persona elegida, solo los suyos; si no, todos (numerados dentro de la ruta de su responsable)
  const stops: { s: Stop; color: string }[] = useMemo(() => {
    if (sel) { const p = people.find((x) => x.id === sel); return (p?.stops ?? []).map((s) => ({ s, color: p!.color })); }
    const byLead = new Map<string, number>();
    return dayVisits.map((v) => {
      const lead = leadOf(v.techs);
      const p = lead ? people.find((x) => x.id === lead.user_id) : undefined;
      const own = p?.stops.find((x) => x.v.visit_id === v.visit_id);
      if (own) return { s: own, color: p!.color };
      const k = lead?.user_id ?? "none"; byLead.set(k, (byLead.get(k) ?? 0) + 1);
      const g = v.address_id ? geo[v.address_id] : undefined;
      const has = g && g.lat !== null && g.lng !== null;
      return { s: { v, no: lead ? byLead.get(k)! : 0, lat: has ? Number(g!.lat) : null, lng: has ? Number(g!.lng) : null, why: has ? "" : !v.address_id || !addressLine(v.site_address) ? "no_address" : g?.geo_status === "not_found" ? "not_found" : "searching" } as Stop, color: lead?.color ?? UNASSIGNED_COLOR };
    });
  }, [sel, people, dayVisits, geo]);
  const missing = stops.filter((x) => x.s.why === "no_address" || x.s.why === "not_found");
  const selected = sel ? people.find((p) => p.id === sel) ?? null : null;

  // ---------- Recorrido de la persona elegida ----------
  const selStamp = selected?.live?.recorded_at ?? "";
  useEffect(() => {
    if (!sel) { setRoute([]); return; }
    let off = false;
    createClient().rpc("tech_route", { p_company: companyId, p_user: sel, p_from: dayStart(day).toISOString(), p_to: addDays(dayStart(day), 1).toISOString() })
      .then(({ data, error }) => { if (off) return; if (error) { if (needsMapSql(error)) setNeedSql(true); setRoute([]); return; } setRoute(((data ?? []) as RoutePoint[]).map((p) => ({ ...p, lat: Number(p.lat), lng: Number(p.lng) }))); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, sel, dayKey, selStamp]);

  // ---------- Pintar (cada capa por separado, para no cerrar el globo abierto de un trabajo cuando llega una posición) ----------
  useEffect(() => {
    const lay = layers.current;
    if (!ready || !lay) return;
    lay.stops.clearLayers();
    stops.forEach(({ s, color }) => {
      if (s.lat === null || s.lng === null) return;
      const v = s.v, a = new Date(v.starts_at), b = new Date(v.ends_at);
      const m = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: "", html: pinHtml(s, color), iconSize: [28, 28], iconAnchor: [14, 14] }), zIndexOffset: v.visit_status === "completed" ? 0 : 200 });
      m.bindPopup(`<div class="bp-pop"><p class="bp-pop-t">${esc(v.customer_name)}</p><p>${esc(v.number)}${v.title ? ` · ${esc(v.title)}` : ""}</p><p>${esc(fmtTime(a))} – ${esc(fmtTime(b))} · <b>${esc(VISIT_LABEL[v.visit_status] ?? "")}</b></p><p class="bp-pop-m">${esc(addressLine(v.site_address))}</p><p class="bp-pop-m">${v.techs.length ? esc(v.techs.map((t) => t.name).join(", ")) : "Unassigned"}</p><a href="/dashboard/jobs/${v.job_id}">Open job</a></div>`);
      m.addTo(lay.stops);
    });
  }, [ready, stops]);

  // Quién sale en el mapa: solo hoy; quien cerró el día ya no aparece (salvo que lo elijas)
  const onMap = useMemo(() => people.filter((p) => isToday && p.live && (!sel || p.id === sel) && (p.live.on_shift || p.id === sel)), [people, isToday, sel]);
  useEffect(() => {
    const lay = layers.current;
    if (!ready || !lay) return;
    lay.techs.clearLayers();
    onMap.forEach((p) => {
      const lv = p.live as LiveRow, fresh = lv.on_shift && isFresh(lv.recorded_at, now);
      const m = L.marker([lv.lat, lv.lng], { icon: L.divIcon({ className: "", html: techHtml(p, fresh), iconSize: [36, 36], iconAnchor: [18, 18] }), zIndexOffset: 1000 });
      m.bindPopup(`<div class="bp-pop"><p class="bp-pop-t">${esc(p.name)}</p><p>${esc(p.status)}</p><p class="bp-pop-m">${fresh ? "Live" : "Last seen"} · ${esc(agoLabel(lv.recorded_at, now))}${lv.accuracy ? ` · ±${Math.round(lv.accuracy)} m` : ""}</p></div>`);
      m.addTo(lay.techs);
    });
  }, [ready, onMap, now]);

  useEffect(() => {
    const lay = layers.current;
    if (!ready || !lay) return;
    lay.route.clearLayers();
    if (!selected) return;
    if (route.length > 1) L.polyline(route.map((r) => [r.lat, r.lng] as L.LatLngTuple), { color: selected.color, weight: 4, opacity: 0.85, lineJoin: "round" }).addTo(lay.route);
    if (route.length) L.circleMarker([route[0].lat, route[0].lng], { radius: 5, color: selected.color, fillColor: "#fff", fillOpacity: 1, weight: 3 }).bindTooltip(`First point · ${fmtTime(new Date(route[0].recorded_at))}`).addTo(lay.route);
    // Lo que falta: de donde está ahora a las paradas pendientes, en orden
    const todo = selected.stops.filter((s) => s.lat !== null && s.v.visit_status !== "completed");
    const from: L.LatLngTuple[] = isToday && selected.live?.on_shift ? [[selected.live.lat, selected.live.lng]] : [];
    const line = [...from, ...todo.map((s) => [s.lat as number, s.lng as number] as L.LatLngTuple)];
    if (line.length > 1) L.polyline(line, { color: selected.color, weight: 2.5, opacity: 0.55, dashArray: "6 8" }).addTo(lay.route);
  }, [ready, selected, route, isToday]);

  // Encuadre: una vez por día / persona elegida (el mapa no se mueve solo cada vez que llega una posición)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const pts: L.LatLngTuple[] = [];
    stops.forEach(({ s }) => { if (s.lat !== null && s.lng !== null) pts.push([s.lat, s.lng]); });
    onMap.forEach((p) => pts.push([(p.live as LiveRow).lat, (p.live as LiveRow).lng]));
    if (sel) route.forEach((r) => pts.push([r.lat, r.lng]));
    const key = `${dayKey}|${sel ?? ""}|${sel && route.length ? 1 : 0}`;
    if (fitted.current === key || !pts.length) return;
    fitted.current = key;
    if (pts.length === 1) map.setView(pts[0], 14); else map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15 });
  }, [ready, stops, onMap, route, sel, dayKey]);

  const sharing = people.filter((p) => p.live?.on_shift).length;
  const toneDot: Record<Person["tone"], string> = { way: "bg-[#7c3aed]", work: "bg-[#f59e0b]", free: "bg-[#16a34a]", off: "bg-slate-300" };

  return (
    <div className="relative isolate z-0 h-full w-full overflow-hidden lg:rounded-b-2xl">
      <style>{`
        .bp-pin{width:28px;height:28px;border-radius:9999px;background:var(--c);border:2.5px solid #fff;box-shadow:0 2px 6px rgba(15,40,60,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:700 12.5px/1 system-ui,sans-serif;transition:transform .12s}
        .bp-pin:hover{transform:scale(1.15)}
        .bp-pin-on{box-shadow:0 0 0 4px color-mix(in srgb,var(--c) 30%,transparent),0 2px 6px rgba(15,40,60,.35)}
        .bp-tech{position:relative;width:36px;height:36px;border-radius:9999px;background:#fff;border:3px solid var(--c);box-shadow:0 3px 10px rgba(15,40,60,.35);display:flex;align-items:center;justify-content:center;color:var(--c);font:800 12px/1 system-ui,sans-serif}
        .bp-tech-live::after{content:"";position:absolute;inset:-7px;border-radius:9999px;border:2px solid var(--c);opacity:.55;animation:bp-live 1.8s ease-out infinite}
        .bp-tech-old{filter:grayscale(.85);opacity:.75}
        @keyframes bp-live{0%{transform:scale(.75);opacity:.6}100%{transform:scale(1.35);opacity:0}}
        .bp-pop{font:13px/1.45 inherit;color:#334155;min-width:170px}.bp-pop p{margin:0}
        .bp-pop-t{font-weight:700;font-size:14px;color:#0b1f3a}.bp-pop-m{color:#64748b;font-size:12.5px}
        .bp-pop a{display:inline-block;margin-top:6px;font-weight:700;color:#0f766e;text-decoration:none}.bp-pop a:hover{text-decoration:underline}
        .leaflet-container{font-family:inherit;background:#eef2f5}.leaflet-popup-content{margin:11px 13px}.leaflet-popup-content-wrapper{border-radius:12px}
      `}</style>
      <div ref={boxRef} className="h-full w-full" aria-label="Map" />

      {/* Lista del equipo: a la izquierda en computadora; en el celular, una hoja abajo que se abre al tocarla */}
      <div className="absolute inset-x-2 bottom-7 z-[1100] flex max-h-[62%] flex-col rounded-2xl border border-slate-200 bg-white/[0.97] shadow-[0_10px_28px_rgba(15,40,60,0.18)] lg:inset-x-auto lg:bottom-3 lg:left-3 lg:top-3 lg:max-h-none lg:w-[16.5rem]">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left lg:cursor-default lg:py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-[#0b1f3a]">{selected ? selected.name : "Team"}</span>
            <span className="block truncate text-[12px] text-slate-500">{selected ? `${selected.stops.length} stop${selected.stops.length === 1 ? "" : "s"} · ${selected.status}` : isToday ? `${sharing} sharing location · ${dayVisits.length} job${dayVisits.length === 1 ? "" : "s"}` : `${dayVisits.length} job${dayVisits.length === 1 ? "" : "s"} this day`}</span>
          </span>
          {searching && <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[#14a39a] border-t-transparent" aria-label="Finding addresses" />}
          <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 lg:hidden ${open ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 5 5 5-5" /></svg>
        </button>

        <div className={`${open ? "block" : "hidden"} min-h-0 flex-1 overflow-y-auto border-t border-slate-100 px-1.5 py-1.5 lg:block`}>
          {needSql && <p className="m-1.5 rounded-lg bg-[#fff6e6] px-3 py-2 text-[12.5px] text-[#92400e]">Run <b>paso-5.9-live-map.sql</b> in Supabase to turn on the live map.</p>}
          {sel && (
            <button type="button" onClick={() => setSel(null)} className="mb-1 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[#0f766e] transition-colors hover:bg-[#e9f7f4]">
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 5-5 5 5 5" /></svg>Everyone
            </button>
          )}
          {!people.length && !needSql && <p className="px-2.5 py-2 text-[13px] text-slate-500">No one on the team receives jobs yet.</p>}
          {people.map((p) => {
            const fresh = isToday && Boolean(p.live?.on_shift) && isFresh(p.live!.recorded_at, now);
            return (
              <button key={p.id} type="button" aria-pressed={sel === p.id} onClick={() => setSel(sel === p.id ? null : p.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-100 ${sel === p.id ? "bg-[#e9f7f4]" : "hover:bg-slate-50"}`}>
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold text-white" style={{ background: p.color }}>
                  {p.initials}
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${fresh ? toneDot[p.tone] : "bg-slate-300"}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-[#0b1f3a]">{p.name}</span>
                  <span className="block truncate text-[12px] text-slate-500">{p.status}</span>
                  {isToday && p.live && <span className={`block text-[11.5px] ${fresh ? "font-medium text-[#15803d]" : "text-slate-400"}`}>{fresh ? "Live" : "Last seen"} · {agoLabel(p.live.recorded_at, now)}</span>}
                </span>
                {p.stops.length > 0 && <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{p.stops.filter((s) => s.v.visit_status === "completed").length}/{p.stops.length}</span>}
              </button>
            );
          })}

          {/* Paradas de la persona elegida, en orden */}
          {selected && selected.stops.length > 0 && (
            <div className="mt-1.5 border-t border-slate-100 px-1 pt-2">
              {selected.stops.map((s) => (
                <button key={s.v.visit_id} type="button" disabled={s.lat === null}
                  onClick={() => { if (s.lat !== null && s.lng !== null) mapRef.current?.setView([s.lat, s.lng], Math.max(mapRef.current.getZoom(), 15)); }}
                  className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-slate-50 disabled:hover:bg-transparent">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold text-white" style={{ background: s.v.visit_status === "completed" ? DONE : selected.color }}>{s.no}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[#0b1f3a]">{s.v.customer_name}</span>
                    <span className="block truncate text-[11.5px] text-slate-500">{fmtTime(new Date(s.v.starts_at))} · {VISIT_LABEL[s.v.visit_status]}{s.why === "no_address" ? " · no address" : s.why === "not_found" ? " · address not found" : ""}</span>
                  </span>
                </button>
              ))}
              {isToday && !route.length && <p className="px-1.5 pb-1 pt-1 text-[11.5px] leading-snug text-slate-400">No route yet today. It draws while {selected.name.split(" ")[0]} has the day started and BrightPro open.</p>}
            </div>
          )}

          {!isToday && <p className="mx-1.5 mt-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-[11.5px] leading-snug text-slate-500">Live positions show only for today. Pick a person to see the route of this day.</p>}

          {missing.length > 0 && (
            <div className="mx-1.5 mt-1.5 rounded-lg bg-[#fff6e6] px-2.5 py-2 text-[12px] text-[#92400e]">
              <button type="button" onClick={() => setShowMissing((x) => !x)} className="flex w-full items-center justify-between gap-2 text-left font-semibold">
                {missing.length} job{missing.length === 1 ? "" : "s"} not on the map
                <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 shrink-0 transition-transform ${showMissing ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 5 5 5-5" /></svg>
              </button>
              {showMissing && (
                <>
                  {missing.map(({ s }) => (
                    <a key={s.v.visit_id} href={`/dashboard/jobs/${s.v.job_id}`} className="mt-1 block truncate hover:underline">{s.v.customer_name} · {s.why === "no_address" ? "no address on the job" : "address not found"}</a>
                  ))}
                  {missing.some(({ s }) => s.why === "not_found") && (
                    <button type="button" disabled={searching} onClick={() => geocode(Array.from(new Set(missing.filter(({ s }) => s.why === "not_found").map(({ s }) => s.v.address_id as string))), true)}
                      className="mt-1.5 rounded-md bg-white px-2 py-1 text-[11.5px] font-semibold text-[#92400e] ring-1 ring-[#fde3b4] transition-colors hover:bg-[#fffaf0] disabled:opacity-50">{searching ? "Searching…" : "Search again"}</button>
                  )}
                  <p className="mt-1.5 text-[11.5px] leading-snug opacity-80">Fix the street, city or ZIP on the customer and it is searched again.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
