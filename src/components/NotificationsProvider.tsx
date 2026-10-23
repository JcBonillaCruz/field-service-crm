"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Digest, Notice, buildNotices } from "@/lib/notifications";

// =====================================================================
// UN solo vigilante de avisos para toda la app (antes había dos campanitas
// —celular y computadora— y cada una consultaba por su cuenta cada 20 s,
// pasando por /api con 10 consultas cada vez).
// Ahora: 1 llamada (función get_company_notifications_digest) cada 90 s,
// se pausa cuando la pestaña no está a la vista y nunca corre dos a la vez.
// =====================================================================
const EVERY = 90_000;      // cada 90 segundos
const MIN_GAP = 30_000;    // al volver a la pestaña, solo si pasaron 30 s
const SEEN = "bp-notices-seen";
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type Push = "unsupported" | "off" | "on" | "blocked";
type Ctx = {
  items: Notice[]; unread: number; markRead: (keys: string[]) => void;
  push: Push; pushMsg: string; enablePush: () => void; disablePush: () => void;
};
const NotificationsCtx = createContext<Ctx | null>(null);
export const useNotifications = () => useContext(NotificationsCtx);

// "Ding" suavecito de dos notas cuando llega algo nuevo (con la app abierta)
function chime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    [[880, 0], [1320, 0.16]].forEach(([f, t]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.45);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.5);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch { /* el navegador no deja sonar sin un clic previo */ }
}
const b64 = (s: string) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };

export default function NotificationsProvider({ companyId, userId, enabled, children }: { companyId: string | null; userId: string; enabled: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<Notice[]>([]);
  const [localRead, setLocalRead] = useState<string[]>([]);
  const [push, setPush] = useState<Push>("off");
  const [pushMsg, setPushMsg] = useState("");
  const busy = useRef(false);          // evita dos consultas al mismo tiempo
  const lastAt = useRef(0);
  const version = useRef<string | null>(null);
  const known = useRef<Set<string> | null>(null);

  const load = useCallback(async (force = false) => {
    if (!enabled || !companyId || busy.current) return;
    if (!force && Date.now() - lastAt.current < MIN_GAP) return;
    busy.current = true;
    try {
      const { data, error } = await createClient().rpc("get_company_notifications_digest", { p_company_id: companyId });
      if (error || !data) return;
      const d = data as Digest;
      const list = buildNotices(d);
      // Algo cambió (el cliente abrió, aceptó, pagaste…): refresca la pantalla, menos en formularios
      if (version.current !== null && d.version && d.version !== version.current && !/\/(new|edit)(\/|$)/.test(window.location.pathname)) router.refresh();
      if (d.version) version.current = d.version;
      if (known.current && list.some((n) => !known.current!.has(n.key))) chime();
      known.current = new Set(list.map((n) => n.key));
      setItems(list);
    } catch { /* sin conexión */ } finally { busy.current = false; lastAt.current = Date.now(); }
  }, [enabled, companyId, router]);

  // Cambio de compañía: empezar de cero
  useEffect(() => { version.current = null; known.current = null; setItems([]); }, [companyId]);

  useEffect(() => {
    try { setLocalRead(JSON.parse(localStorage.getItem(SEEN) || "[]")); } catch { /* */ }
    load(true);
    const t = setInterval(() => { if (document.visibilityState === "visible") load(true); }, EVERY);
    const onShow = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onShow); };
  }, [load]);

  // Marcar como leído: desaparece al instante aquí y en todos tus dispositivos
  const markRead = useCallback((keys: string[]) => {
    if (!keys.length) return;
    setLocalRead((prev) => {
      const next = Array.from(new Set([...prev, ...keys])).slice(-400);
      try { localStorage.setItem(SEEN, JSON.stringify(next)); } catch { /* */ }
      return next;
    });
    createClient().from("notification_reads").upsert(keys.map((key) => ({ user_id: userId, key })), { onConflict: "user_id,key", ignoreDuplicates: true })
      .then(() => undefined, () => undefined);
  }, [userId]);

  // Alertas con sonido (push) — se registra una sola vez
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID) { setPush("unsupported"); return; }
    if (Notification.permission === "denied") { setPush("blocked"); return; }
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setPush(sub && Notification.permission === "granted" ? "on" : "off");
    }).catch(() => setPush("unsupported"));
  }, []);
  const enablePush = useCallback(async () => {
    setPushMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setPush(perm === "denied" ? "blocked" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) { setPushMsg((await res.json().catch(() => ({}))).error || "It couldn't be turned on."); return; }
      setPush("on"); chime();
    } catch { setPushMsg("This device can't receive alerts. On iPhone, add BrightPro to your Home Screen first."); }
  }, []);
  const disablePush = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    setPush("off");
  }, []);

  const visible = useMemo(() => items.filter((n) => !localRead.includes(n.key)), [items, localRead]);
  const value = useMemo<Ctx>(() => ({ items: visible, unread: visible.length, markRead, push, pushMsg, enablePush, disablePush }),
    [visible, markRead, push, pushMsg, enablePush, disablePush]);
  return <NotificationsCtx.Provider value={value}>{children}</NotificationsCtx.Provider>;
}
