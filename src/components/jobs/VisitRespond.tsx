"use client";

import { useState } from "react";
import type { Lang } from "@/lib/customer-notice-text";

// Paso 5.8 · Lo que ve el cliente al abrir el enlace del recordatorio (teléfono primero, sin cuenta)
const T = {
  en: {
    lead: (n: string, c: string) => `${n ? `Hi ${n}, please` : "Please"} confirm your appointment with ${c}.`, title: "Your appointment", when: "When", between: "Arriving between", at: "Arriving at", service: "Service", address: "Address", ref: "Reference",
    confirm: "Confirm appointment", change: "Request another time", ask: "What day or time works better for you?", ph: "Example: Thursday after 2 PM", send: "Send request", back: "Back",
    okTitle: "Your appointment is confirmed", okText: (c: string) => `Thank you. ${c} will see you then.`, needChange: "Need another time?",
    chTitle: "We got your request", chText: (c: string) => `${c} will contact you to set a new time. Your appointment stays as it is until then.`, keep: "Keep my appointment as it is",
    cancelled: "This appointment was cancelled", closed: "This appointment can't be changed here anymore", call: (c: string, p: string | null) => `Please contact ${c}${p ? ` at ${p}` : ""}.`,
    error: "Something went wrong. Please try again.", powered: "Sent with BrightPro",
  },
  es: {
    lead: (n: string, c: string) => `${n ? `Hola ${n}, por favor` : "Por favor"} confirme su cita con ${c}.`, title: "Su cita", when: "Cuándo", between: "Llegada entre", at: "Llegada", service: "Servicio", address: "Dirección", ref: "Referencia",
    confirm: "Confirmar cita", change: "Pedir otro horario", ask: "¿Qué día u hora le queda mejor?", ph: "Ejemplo: jueves después de las 2 PM", send: "Enviar solicitud", back: "Volver",
    okTitle: "Su cita está confirmada", okText: (c: string) => `Gracias. El equipo de ${c} le espera ese día.`, needChange: "¿Necesita otro horario?",
    chTitle: "Recibimos su solicitud", chText: (c: string) => `${c} se comunicará con usted para acordar el nuevo horario. Su cita sigue igual hasta entonces.`, keep: "Dejar mi cita como está",
    cancelled: "Esta cita fue cancelada", closed: "Esta cita ya no se puede cambiar desde aquí", call: (c: string, p: string | null) => `Por favor comuníquese con ${c}${p ? ` al ${p}` : ""}.`,
    error: "Algo salió mal. Inténtelo de nuevo.", powered: "Enviado con BrightPro",
  },
};

function Art({ kind }: { kind: "calendar" | "ok" | "change" | "off" }) {
  const tone = kind === "ok" ? ["#e7f6f1", "#0f766e"] : kind === "change" ? ["#fff4e6", "#c2410c"] : kind === "off" ? ["#f1f5f9", "#64748b"] : ["#e9f7f4", "#0f766e"];
  return (
    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: tone[0], color: tone[1] }}>
      <svg viewBox="0 0 32 32" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="7" width="22" height="20" rx="4" fill="#fff" /><path d="M5 13h22M11 4v6M21 4v6" />
        {kind === "ok" && <path d="m11.5 20 3.2 3.2 6-6.4" />}
        {kind === "change" && <path d="M12 21.5h8m0 0-2.6-2.6M20 21.5l-2.6 2.6" />}
        {kind === "off" && <path d="m12.5 17.5 7 7m0-7-7 7" />}
        {kind === "calendar" && <><circle cx="11.5" cy="18.5" r="1" fill="currentColor" /><circle cx="16" cy="18.5" r="1" fill="currentColor" /><circle cx="20.5" cy="18.5" r="1" fill="currentColor" /><circle cx="11.5" cy="22.5" r="1" fill="currentColor" /></>}
      </svg>
    </span>
  );
}

export default function VisitRespond(p: {
  token: string; lang: Lang; state: "open" | "cancelled" | "closed"; reply: "confirmed" | "reschedule" | null; startChange: boolean;
  company: string; logoUrl: string | null; phone: string | null; customer: string; day: string; arrival: string; service: string | null; address: string; number: string; whiteLabel: boolean;
}) {
  const t = T[p.lang];
  const [reply, setReply] = useState(p.reply);
  const [changing, setChanging] = useState(p.state === "open" && p.startChange && p.reply !== "reschedule");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState(p.state);

  async function send(action: "confirm" | "reschedule") {
    setBusy(action); setError("");
    const r = await fetch("/api/visit/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: p.token, action, note }) })
      .then((x) => x.json()).catch(() => null) as { result?: string } | null;
    setBusy("");
    if (r?.result === "confirmed" || r?.result === "reschedule") { setReply(r.result); setChanging(false); return; }
    if (r?.result === "cancelled" || r?.result === "closed") { setState(r.result); return; }
    setError(t.error);
  }

  const rows: [string, string][] = [[t.when, p.day ? `${p.day} · ${p.arrival.includes("–") ? t.between : t.at} ${p.lang === "es" ? p.arrival.replace(" – ", " y ") : p.arrival.replace(" – ", " and ")}` : ""], [t.service, p.service ?? ""], [t.address, p.address], [t.ref, p.number]];
  const btn = "flex h-12 w-full items-center justify-center rounded-xl text-[16px] font-semibold transition-all active:scale-[0.99] disabled:opacity-60";

  return (
    <main className="min-h-screen bg-[#f4f6f8] px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_40px_rgba(15,40,60,0.08)]">
        <div className="h-1.5 bg-[#0f766e]" />
        <div className="px-6 pb-7 pt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.logoUrl ? <img src={p.logoUrl} alt={p.company} className="mx-auto max-h-14 max-w-[11rem] object-contain" /> : <p className="text-center text-[18px] font-bold text-[#0b1f3a]">{p.company}</p>}

          <div className="mt-6 text-center">
            <Art kind={state === "cancelled" ? "off" : state === "closed" ? "calendar" : reply === "confirmed" && !changing ? "ok" : reply === "reschedule" && !changing ? "change" : "calendar"} />
            <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-[#0b1f3a]">
              {state === "cancelled" ? t.cancelled : state === "closed" ? t.closed : changing ? t.change : reply === "confirmed" ? t.okTitle : reply === "reschedule" ? t.chTitle : t.title}
            </h1>
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">
              {state !== "open" ? t.call(p.company, p.phone) : changing ? t.ask : reply === "confirmed" ? t.okText(p.company) : reply === "reschedule" ? t.chText(p.company) : t.lead(p.customer, p.company)}
            </p>
          </div>

          <dl className="mt-5 space-y-2.5 rounded-2xl bg-[#f8fafc] px-4 py-3.5">
            {rows.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex gap-3 text-[14.5px]"><dt className="w-24 shrink-0 text-slate-500">{k}</dt><dd className={`min-w-0 flex-1 text-[#0b1f3a] ${state === "cancelled" && k === t.when ? "line-through" : ""}`}>{v}</dd></div>
            ))}
          </dl>

          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-[14px] text-red-700">{error}</p>}

          {state === "open" && changing && (
            <div className="mt-5">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder={t.ph} aria-label={t.ask}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] text-slate-800 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
              <button type="button" disabled={!!busy} onClick={() => send("reschedule")} className={`${btn} mt-3 bg-[#0f766e] text-white hover:bg-[#0c5f59]`}>{busy === "reschedule" ? "…" : t.send}</button>
              <button type="button" disabled={!!busy} onClick={() => setChanging(false)} className="mt-2 w-full py-2 text-[14.5px] font-semibold text-slate-500 hover:text-[#0b1f3a]">{t.back}</button>
            </div>
          )}
          {state === "open" && !changing && !reply && (
            <div className="mt-5 space-y-2.5">
              <button type="button" disabled={!!busy} onClick={() => send("confirm")} className={`${btn} bg-[#0f766e] text-white hover:bg-[#0c5f59]`}>{busy === "confirm" ? "…" : t.confirm}</button>
              <button type="button" disabled={!!busy} onClick={() => setChanging(true)} className={`${btn} border border-[#b6dcd5] bg-white text-[#0f766e] hover:bg-[#e9f7f4]`}>{t.change}</button>
            </div>
          )}
          {state === "open" && !changing && reply === "confirmed" && (
            <button type="button" onClick={() => setChanging(true)} className="mt-5 w-full py-2 text-[14.5px] font-semibold text-[#0f766e] hover:underline">{t.needChange}</button>
          )}
          {state === "open" && !changing && reply === "reschedule" && (
            <button type="button" disabled={!!busy} onClick={() => send("confirm")} className="mt-5 w-full py-2 text-[14.5px] font-semibold text-[#0f766e] hover:underline">{t.keep}</button>
          )}
        </div>
      </div>
      {!p.whiteLabel && <p className="mt-6 text-center text-xs text-slate-400">{t.powered}</p>}
    </main>
  );
}
