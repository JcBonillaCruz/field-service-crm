"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { askConfirm } from "@/lib/confirm";
import { smsLink, waLink } from "@/lib/customer-notice-text";

// =====================================================================
// Paso 5.8 · Avisos al cliente en la ficha del trabajo (oficina y dueño):
// si el cliente confirmó o pidió otro horario, mandar el recordatorio o pedir la reseña
// por correo, o por texto / WhatsApp desde el teléfono de la oficina.
// =====================================================================
type Kind = "reminder" | "review";
export type CnState = {
  needsSql: boolean;
  settings?: { cn_on_my_way: boolean; cn_reminder: boolean; cn_reminder_days: number; cn_review: boolean; review_url: string | null; review_ok: boolean };
  contact?: { email: string | null; phone: string | null; lang: "en" | "es" };
  visit?: { id: string; when: string; reminder_sent_at: string | null; reply: "confirmed" | "reschedule" | null; reply_at: string | null; reply_note: string | null } | null;
  review?: { asked_at: string | null; can_ask: boolean; recently: boolean };
  texts?: { reminder: string | null; review: string | null };
};
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

export function useCustomerNotices(jobId: string, refreshKey: string | number) {
  const [state, setState] = useState<CnState | null>(null);
  const reload = useCallback(async () => {
    const r = await fetch(`/api/jobs/customer-notice?jobId=${jobId}`, { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    setState((r as CnState | null) ?? { needsSql: true });
  }, [jobId]);
  useEffect(() => { reload(); }, [reload, refreshKey]);
  return { state, reload };
}

// Arriba de la ficha: el cliente pidió otro horario (para que la oficina lo vea de una vez, también en el celular)
export function RescheduleBanner({ state, jobId, phone }: { state: CnState | null; jobId: string; phone: string | null }) {
  const v = state?.visit;
  if (!v || v.reply !== "reschedule") return null;
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#fecdd3] bg-[#fff7f8] px-4 py-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#be123c] ring-1 ring-[#fecdd3]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4M9 15.5h6m0 0-2-2m2 2-2 2" /></svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold text-[#9f1239]">The customer asked for another time</p>
        <p className="text-[13px] text-[#be123c]">{v.reply_note ? `“${v.reply_note}” · ` : ""}Appointment: {v.when}{v.reply_at ? ` · asked ${when(v.reply_at)}` : ""}</p>
      </div>
      {phone && <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="rounded-lg border border-[#fecdd3] bg-white px-3.5 py-2 text-[14px] font-semibold text-[#be123c] transition-colors hover:bg-[#fff1f2]">Call</a>}
      <Link prefetch={false} href={`/dashboard/jobs/${jobId}/edit`} className="rounded-lg bg-[#be123c] px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#9f1239]">Reschedule</Link>
    </section>
  );
}

const Dot = ({ tone }: { tone: "green" | "rose" | "amber" | "slate" }) => (
  <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${tone === "green" ? "bg-[#14a39a]" : tone === "rose" ? "bg-[#e11d48]" : tone === "amber" ? "bg-[#f59e0b]" : "bg-slate-300"}`} />
);
const linkBtn = "text-[13px] font-semibold text-[#0f766e] hover:underline disabled:opacity-50";
const viaBtn = "flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition-colors hover:border-[#b6dcd5] hover:bg-[#e9f7f4] hover:text-[#0f766e] disabled:opacity-50";

export default function CustomerNotices({ jobId, state, reload, cancelled, onToast, startOpen = null }: {
  jobId: string; state: CnState | null; reload: () => void; cancelled: boolean; onToast: (m: string, err?: boolean) => void; startOpen?: Kind | null;
}) {
  const [open, setOpen] = useState<Kind | null>(startOpen);
  const [busy, setBusy] = useState("");
  if (!state) return <div className="h-16 animate-pulse rounded-xl bg-slate-100" />;
  if (state.needsSql || !state.settings) return <p className="mt-1 text-[13px] text-slate-500">Customer notices need the Paso 5.8 database update.</p>;
  const s = state.settings, v = state.visit, c = state.contact!, rv = state.review!;
  const text = open ? state.texts?.[open] ?? "" : "";

  async function send(kind: Kind, via: "email" | "text" | "whatsapp" | "copy") {
    if (via === "email") {
      const again = kind === "review" && (rv.asked_at || rv.recently);
      if (!(await askConfirm({
        title: kind === "reminder" ? "Email the reminder now?" : "Email the review request now?",
        message: `It goes to ${c.email}${again ? ". This customer was already asked for a review in the last 90 days." : kind === "reminder" ? " with the Confirm and Request another time buttons." : " with the button to your Google reviews."}`,
        confirmLabel: "Send email", tone: "green",
      }))) return;
    }
    if (via === "copy") { try { await navigator.clipboard.writeText(text); } catch { onToast("Couldn't copy. Select the text and copy it.", true); return; } }
    setBusy(`${kind}-${via}`);
    const r = await fetch("/api/jobs/customer-notice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, kind, via }) })
      .then((x) => x.json()).catch(() => null) as { ok?: boolean; reason?: string | null } | null;
    setBusy("");
    if (!r?.ok) { onToast(r?.reason === "no_email" ? "This customer has no email. Use Text or WhatsApp." : r?.reason === "send_failed" ? "The email could not be sent. Try again." : "Couldn't send it. Try again.", true); return; }
    onToast(via === "email" ? `Sent to ${c.email}` : via === "copy" ? "Message copied" : "Saved in the job history");
    setOpen(null); reload();
  }

  return (
    <div className="mt-2 space-y-3">
      {/* Próxima visita: recordatorio y respuesta del cliente */}
      {v ? (
        <div>
          <div className="flex items-start gap-2">
            <Dot tone={v.reply === "confirmed" ? "green" : v.reply === "reschedule" ? "rose" : v.reminder_sent_at ? "amber" : "slate"} />
            <p className="min-w-0 flex-1 text-[14px] text-slate-700">
              {v.reply === "confirmed" ? <><b className="text-[#0f766e]">Confirmed by the customer</b>{v.reply_at ? ` · ${when(v.reply_at)}` : ""}</>
                : v.reply === "reschedule" ? <><b className="text-[#be123c]">Asked for another time</b>{v.reply_note ? ` — “${v.reply_note}”` : ""}</>
                : v.reminder_sent_at ? <>Reminder sent {when(v.reminder_sent_at)} · <span className="text-slate-500">no answer yet</span></>
                : s.cn_reminder ? <>The reminder goes out by itself {s.cn_reminder_days === 2 ? "2 days" : "1 day"} before the visit.</>
                : <>Automatic reminders are off.</>}
              <span className="block text-[12.5px] text-slate-500">{v.when}</span>
            </p>
          </div>
          {!cancelled && <button type="button" onClick={() => setOpen(open === "reminder" ? null : "reminder")} className={`${linkBtn} ml-4 mt-1`}>{v.reminder_sent_at ? "Send the reminder again" : "Send the reminder now"}</button>}
        </div>
      ) : <p className="text-[13.5px] text-slate-400">No upcoming visit to remind.</p>}

      {/* Reseña en Google (solo con el trabajo terminado) */}
      {rv.can_ask && (
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-start gap-2">
            <Dot tone={rv.asked_at ? "green" : "slate"} />
            <p className="min-w-0 flex-1 text-[14px] text-slate-700">
              {rv.asked_at ? <>Google review requested · {when(rv.asked_at)}</> : !s.review_ok ? <>Add your Google review link to ask for reviews.</> : rv.recently ? <>This customer was asked for a review in the last 90 days.</> : s.cn_review ? <>Review not requested yet.</> : <>Automatic review requests are off.</>}
            </p>
          </div>
          {s.review_ok ? <button type="button" onClick={() => setOpen(open === "review" ? null : "review")} className={`${linkBtn} ml-4 mt-1`}>{rv.asked_at ? "Ask again" : "Ask for a Google review"}</button>
            : <Link prefetch={false} href="/dashboard/jobs/settings" className={`${linkBtn} ml-4 mt-1 inline-block`}>Open Jobs settings</Link>}
        </div>
      )}

      {/* Cómo mandarlo: correo, o desde el teléfono de la oficina */}
      {open && (
        <div className="rounded-xl border border-slate-200 bg-[#f8fafc] p-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{open === "reminder" ? "Send reminder by" : "Ask for review by"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" disabled={!c.email || !!busy} onClick={() => send(open, "email")} className={viaBtn} title={c.email ?? "This customer has no email"}>Email</button>
            <a href={smsLink(c.phone, text)} onClick={() => send(open, "text")} className={viaBtn}>Text</a>
            {c.phone ? <a href={waLink(c.phone, text)} target="_blank" rel="noreferrer" onClick={() => send(open, "whatsapp")} className={viaBtn}>WhatsApp</a>
              : <button type="button" disabled className={viaBtn} title="This customer has no phone">WhatsApp</button>}
            <button type="button" disabled={!!busy} onClick={() => send(open, "copy")} className={viaBtn}>Copy</button>
          </div>
          <p className="mt-2 text-[12.5px] text-slate-500">{c.email ? `Email goes to ${c.email}.` : "This customer has no email."} Text and WhatsApp open on this device with the message ready ({c.lang === "es" ? "Spanish" : "English"}).</p>
          <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-white px-3 py-2 text-[13px] text-slate-700 ring-1 ring-slate-200">{text}</p>
        </div>
      )}

      {!s.cn_on_my_way && !s.cn_reminder && !s.cn_review && (
        <p className="border-t border-slate-100 pt-3 text-[12.5px] text-slate-500">Automatic notices are off. <Link prefetch={false} href="/dashboard/jobs/settings" className="font-semibold text-[#0f766e] hover:underline">Turn them on</Link></p>
      )}
    </div>
  );
}
