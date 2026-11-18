"use client";

import { useEffect, useState } from "react";
import { inputClass } from "@/components/customers/ui";
import SelectMenu from "@/components/ui/SelectMenu";
import type { JobSettings } from "@/lib/jobs";
import { CnKind, validReviewUrl } from "@/lib/customer-notice-text";

// =====================================================================
// Paso 5.8 · Jobs → Settings → Customer notices
// Tres avisos por correo, cada uno con su interruptor (todos empiezan apagados) y su vista previa.
// =====================================================================
const card = "rounded-2xl border border-slate-200 bg-white";

// Íconos ilustrados, en el estilo de los íconos de las apps
function Art({ kind }: { kind: CnKind }) {
  const tone = kind === "on_my_way" ? ["#f3efff", "#6d28d9"] : kind === "reminder" ? ["#e9f7f4", "#0f766e"] : ["#fff7e0", "#b45309"];
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105" style={{ background: tone[0], color: tone[1] }}>
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {kind === "on_my_way" && <><path d="M2.5 7.5h10v8h-10z" fill="#fff" /><path d="M12.5 10h3.6l3.4 3v2.5h-7" fill="#fff" /><circle cx="6.5" cy="16.5" r="1.8" fill="#fff" /><circle cx="16" cy="16.5" r="1.8" fill="#fff" /><path d="M20.5 6.5h1M19 4l.7.7" /></>}
        {kind === "reminder" && <><rect x="3.5" y="5" width="17" height="15" rx="3" fill="#fff" /><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2.2 2.2L15.5 13" /></>}
        {kind === "review" && <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z" fill="#fff" />}
      </svg>
    </span>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-[#0f766e]" : "bg-slate-300"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

// Una fila por aviso: ícono, explicación, vista previa e interruptor (fuera del componente para que el campo del enlace no pierda el cursor)
function Row({ kind, title, text, on, onChange, onPreview, children }: { kind: CnKind; title: string; text: string; on: boolean; onChange: (v: boolean) => void; onPreview: (k: CnKind) => void; children?: React.ReactNode }) {
  return (
    <div className="group py-4">
      <div className="flex items-start gap-3">
        <Art kind={kind} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-[#0b1f3a]">{title}</p>
          <p className="text-[13px] text-slate-500">{text}</p>
          <button type="button" onClick={() => onPreview(kind)} className="mt-1 text-[13px] font-semibold text-[#0f766e] hover:underline">Preview email</button>
        </div>
        <Toggle on={on} onChange={onChange} label={title} />
      </div>
      {children && <div className="mt-3 sm:pl-[3.25rem]">{children}</div>}
    </div>
  );
}

export default function CustomerNoticeSettings({ s, patch }: { s: JobSettings; patch: (p: Partial<JobSettings>) => void }) {
  const [preview, setPreview] = useState<CnKind | null>(null);
  const [url, setUrl] = useState(s.review_url ?? "");
  const [urlError, setUrlError] = useState("");
  useEffect(() => setUrl(s.review_url ?? ""), [s.review_url]);
  const needsSql = s.cn_on_my_way === undefined;
  const linkOk = validReviewUrl(s.review_url);

  function saveUrl() {
    const v = url.trim();
    if (v === (s.review_url ?? "")) return;
    if (v && !validReviewUrl(v)) { setUrlError("Paste the full link. It starts with https://"); return; }
    setUrlError("");
    patch(v ? { review_url: v } : { review_url: null, cn_review: false });
  }

  return (
    <section className={`${card} px-5 pt-4`}>
      <h2 className="text-[16px] font-semibold text-[#0b1f3a]">Customer notices</h2>
      <p className="text-[13px] text-slate-500">Emails your customers get by themselves, with your logo. Customers set to Spanish get them in Spanish. Everything starts off until you turn it on.</p>
      {needsSql ? (
        <p className="my-4 rounded-xl bg-[#fffaf0] px-4 py-3 text-[13.5px] text-[#92400e]">Run the Paso 5.8 database update in Supabase to use customer notices.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          <Row kind="on_my_way" onPreview={setPreview} title="On my way" on={Boolean(s.cn_on_my_way)} onChange={(v) => patch({ cn_on_my_way: v })}
            text="When the technician taps On my way and picks the arrival time, the customer gets an email with the technician's name and the estimated arrival." />
          <Row kind="reminder" onPreview={setPreview} title="Appointment reminder" on={Boolean(s.cn_reminder)} onChange={(v) => patch({ cn_reminder: v })}
            text="Sent in the morning with Confirm and Request another time buttons. You get an alert if the customer asks for another time.">
            <label className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-medium text-slate-600">Send it</span>
              <span className="w-52"><SelectMenu value={String(s.cn_reminder_days === 2 ? 2 : 1)} ariaLabel="When to send the reminder"
                options={[{ value: "1", label: "1 day before the visit" }, { value: "2", label: "2 days before the visit" }]} onChange={(v) => patch({ cn_reminder_days: Number(v) })} /></span>
            </label>
          </Row>
          <Row kind="review" onPreview={setPreview} title="Ask for a Google review" on={Boolean(s.cn_review) && linkOk}
            onChange={(v) => { if (v && !linkOk) { setUrlError("Add your Google review link first."); return; } patch({ cn_review: v }); }}
            text="When the technician finishes the job, the customer gets a thank-you email with the button to your Google reviews. Every customer gets the same request, at most once every 90 days, and never for jobs left for follow-up or cancelled.">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-600">Google review link</span>
              <input value={url} onChange={(e) => { setUrl(e.target.value); setUrlError(""); }} onBlur={saveUrl} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveUrl(); } }}
                inputMode="url" placeholder="https://g.page/r/…/review" className={inputClass} aria-invalid={Boolean(urlError)} />
              {urlError ? <span role="alert" className="mt-1 block text-[12.5px] font-medium text-[#be123c]">{urlError}</span>
                : <span className="mt-1 block text-[12px] text-slate-400">Google Business Profile → Ask for reviews → copy the link.</span>}
            </label>
          </Row>
        </div>
      )}

      {preview && <PreviewDialog kind={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}

// Vista previa: el mismo correo que recibe el cliente, con datos de ejemplo
function PreviewDialog({ kind, onClose }: { kind: CnKind; onClose: () => void }) {
  const [lang, setLang] = useState<"en" | "es">("en");
  const [html, setHtml] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  useEffect(() => {
    let live = true;
    setHtml(null);
    fetch(`/api/jobs/customer-notice/preview?kind=${kind}&lang=${lang}`, { cache: "no-store" }).then(async (r) => {
      const text = r.ok ? await r.text() : "<p style='font-family:sans-serif;padding:24px'>The preview isn't available right now.</p>";
      if (live) { setHtml(text); setSubject(decodeURIComponent(r.headers.get("X-Subject") ?? "")); }
    }).catch(() => live && setHtml("<p style='font-family:sans-serif;padding:24px'>The preview isn't available right now.</p>"));
    return () => { live = false; };
  }, [kind, lang]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Email preview" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-3xl bg-white animate-[bp-sheet_0.22s_ease-out] sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-[#0b1f3a]">Email preview</p>
            <p className="truncate text-[12.5px] text-slate-500">{subject ? `Subject: ${subject}` : "Sample data"}</p>
          </div>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-[13px] font-semibold">
            {(["en", "es"] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} className={`rounded-md px-2.5 py-1 transition-colors ${lang === l ? "bg-white text-[#0f766e] shadow-sm" : "text-slate-500"}`}>{l === "en" ? "English" : "Español"}</button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
          </button>
        </div>
        {html === null ? <div className="m-5 h-72 animate-pulse rounded-2xl bg-slate-100" />
          : <iframe title="Email preview" sandbox="" srcDoc={html} className="h-[70dvh] w-full border-0 bg-[#f4f6f8] sm:h-[560px]" />}
      </div>
    </div>
  );
}
